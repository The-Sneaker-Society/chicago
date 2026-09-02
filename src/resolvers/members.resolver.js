import dotenv from "dotenv";
import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import VaultModel from "../models/Vault.model";
import ChatModel from "../models/Chat.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import ProductsModel from "../models/Products.model";
import * as stripeService from "../stripe/stripe.service";
import * as redisService from "../utils/redis/stripeSubscritpitonCache";
import { createQRCode } from "../utils/qrGenerator";

dotenv.config({ path: "config.env" });

const Query = {
  async members(parent, args, ctx, info) {
    try {
      const members = await MemberModel.find();
      return members;
    } catch (e) {
      throw new Error(e);
    }
  },
  async memberById(parent, args, ctx, info) {
    try {
      const member = await MemberModel.find({ clerkId: ctx.userId });
      if (!member) {
        throw new Error("Member not found");
      }

      return member[0];
    } catch (e) {
      throw new Error(e);
    }
  },
  async currentMember(parent, args, ctx, info) {
    try {
      const member = await MemberModel.find({ clerkId: ctx.userId });
      if (!member) {
        throw new Error("Member not found");
      }

      return member[0];
    } catch (e) {
      throw new Error(e);
    }
  },
  async stripeWidgetData(parent, args, ctx, info) {
    try {
      const { stripeConnectAccountId, _id: memberId } = ctx.dbUser;

      if (!stripeConnectAccountId) {
        throw new Error("Not synced with stripe");
      }

      // Sum all pending payouts from the contract ledger — no Stripe balance call.
      const pendingAgg = await ContractModel.aggregate([
        { $match: { memberId: memberId, payoutStatus: "pending" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$payoutAmount" },
            count: { $sum: 1 },
            totalFees: { $sum: "$platformFee" },
            totalGross: { $sum: "$proposedPrice" },
          },
        },
      ]);

      const pendingAmount = pendingAgg[0]?.total ?? 0;
      const pendingCount = pendingAgg[0]?.count ?? 0;
      const totalFees = pendingAgg[0]?.totalFees ?? 0;
      const totalGross = pendingAgg[0]?.totalGross ?? 0;

      // Most recent paid contract as the "previous payout" reference.
      const lastPaidContract = await ContractModel.findOne(
        { memberId: memberId, payoutStatus: "paid" },
        { payoutAmount: 1 },
        { sort: { paidAt: -1 } }
      );

      const prevRaw = lastPaidContract?.payoutAmount ?? null;
      const prevFormatted =
        prevRaw != null
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(prevRaw)
          : null;

      const percentChange =
        prevRaw && prevRaw > 0
          ? Math.round(((pendingAmount - prevRaw) / prevRaw) * 100)
          : 0;

      const formattedPayoutAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(pendingAmount);

      const accountStatus = await stripeService.getAccountStatus(
        stripeConnectAccountId
      );

      return {
        stripeConnectAccountId,
        percentChange,
        nextPayoutDate: null,
        payoutAmount: formattedPayoutAmount,
        previousPayoutAmount: prevFormatted,
        accountStatus,
        pendingCount,
        totalFees,
        totalGross,
      };
    } catch (e) {
      throw new Error(e);
    }
  },
  async subscriptionDetails(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;

      const details = await stripeService.getMemberSubscriptionDetails(
        stripeCustomerId
      );

      return details;
    } catch (e) {
      throw new Error(e);
    }
  },

  async revenueSummary(parent, args, ctx, info) {
    try {
      const contractIds = ctx.dbUser.contracts;

      if (!contractIds || contractIds.length === 0) {
        const emptyMonths = buildEmptyMonths();
        return { months: emptyMonths, percentChange: 0 };
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const contracts = await ContractModel.find({
        _id: { $in: contractIds },
        createdAt: { $gte: sixMonthsAgo },
      }).sort({ createdAt: 1 });

      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = date.toLocaleString("default", { month: "short" });

        const monthContracts = contracts.filter((c) => {
          const created = new Date(Number(c.createdAt));
          return (
            created.getMonth() === date.getMonth() &&
            created.getFullYear() === date.getFullYear()
          );
        });

        const revenue = monthContracts
          .filter((c) => c.status === "PAYOUT_RELEASED")
          .reduce((sum, c) => sum + (c.price || 0), 0);

        months.push({
          month: monthStr,
          revenue,
          newContracts: monthContracts.length,
          completed: monthContracts.filter((c) => c.status === "PAYOUT_RELEASED").length,
        });
      }

      const lastMonthRev = months[months.length - 1]?.revenue || 0;
      const prevMonthRev = months[months.length - 2]?.revenue || 0;
      const percentChange =
        prevMonthRev > 0
          ? Math.round(((lastMonthRev - prevMonthRev) / prevMonthRev) * 100) / 100
          : 0;

      return { months, percentChange };
    } catch (e) {
      throw new Error(e);
    }
  },

  async getDiscoverMembers(parent, args, ctx) {
    try {
      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;

      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });

      // IDs to exclude: self + already-followed members
      const excludeIds = currentMember
        ? [currentMember._id, ...(currentMember.following || [])]
        : [];

      // IDs the current member already follows — used for mutual connection scoring
      const followingIds = currentMember?.following?.map(String) || [];

      const matchStage = {
        isActive: true,
        deletedAt: null,
        ...(excludeIds.length > 0 && { _id: { $nin: excludeIds } }),
      };

      // Aggregation pipeline:
      // 1. Filter active, non-deleted, non-followed, non-self members
      // 2. Compute a relevance score from community signals:
      //    - mutualCount  (×3): followers who the current user also follows
      //    - followerCount (×1): established presence in the community
      //    - isPro         (+2): active subscription signals engagement
      // 3. Sort by score desc, then createdAt desc as a tiebreaker
      // 4. Get total before slicing, then apply skip/limit
      const pipeline = [
        { $match: matchStage },
        {
          $addFields: {
            mutualCount: followingIds.length
              ? {
                  $size: {
                    $setIntersection: [
                      { $map: { input: "$followers", as: "f", in: { $toString: "$$f" } } },
                      followingIds,
                    ],
                  },
                }
              : 0,
            followerCount: { $size: { $ifNull: ["$followers", []] } },
            isPro: { $eq: ["$subscriptionStatus", "active"] },
          },
        },
        {
          $addFields: {
            _score: {
              $add: [
                { $multiply: ["$mutualCount", 3] },
                "$followerCount",
                { $cond: ["$isPro", 2, 0] },
              ],
            },
          },
        },
        { $sort: { _score: -1, createdAt: -1 } },
        // Only return fields defined on PublicMember — no PII, no billing data
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            businessName: 1,
            state: 1,
            isActive: 1,
            subscriptionStatus: 1,
          },
        },
      ];

      const [countResult, items] = await Promise.all([
        MemberModel.aggregate([...pipeline, { $count: "total" }]),
        MemberModel.aggregate([...pipeline, { $skip: offset }, { $limit: limit }]),
      ]);

      const totalCount = countResult[0]?.total ?? 0;
      const hasMore = offset + items.length < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      return { items, totalCount, hasMore, nextOffset };
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createMember(parent, args, ctx, info) {
    try {
      const {
        clerkId,
        email,
        firstName,
        lastName,
        phoneNumber,
        addressLineOne,
        addressLineTwo,
        state,
        zipcode,
      } = args.data;

      const member = await MemberModel.findOne({ clerkId: clerkId });

      if (member) {
        throw new UserInputError(
          "Email is taken. If this is wrong please contact support",
          {
            errors: {
              email: "This email is taken.",
            },
          }
        );
      }

      const newMember = new MemberModel({
        email,
        clerkId,
        firstName,
        lastName,
        phoneNumber,
        zipcode,
        addressLineOne,
        addressLineTwo,
        state,
        zipcode,
        isActive: true,
      });

      const res = await newMember.save();

      return { ...res._doc, id: res._id };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async updateMember(parent, args, ctx, info) {
    try {
      await MemberModel.findByIdAndUpdate(
        ctx.dbUser._id,
        { ...args.data },
        { new: true }
      );
      return true;
    } catch (error) {
      throw error;
    }
  },
  async deleteMember(parent, args, ctx, info) {
    try {
      await MemberModel.findByIdAndUpdate(
        ctx.id,
        { deletedAt: Date.now() },
        { new: true }
      );
      return true; // test
    } catch (e) {
      throw new Error(e);
    }
  },
  async onboardMemberToStripe(parent, args, ctx, info) {
    try {
      const createdStripeAccountId = await stripeService.createExpressaccount(
        ctx.userId
      );
      const member = await MemberModel.findByIdAndUpdate(
        ctx.dbUser.id,
        { stripeConnectAccountId: createdStripeAccountId.id },
        { new: true }
      );

      const { url } = await stripeService.createAccountLink(
        member.stripeConnectAccountId
      );

      return url;
    } catch (error) {
      throw new Error(error);
    }
  },
  async resumeAccountOnboarding(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(ctx.dbUser.id);

      const { url } = await stripeService.createAccountLink(
        member.stripeConnectAccountId
      );

      return url;
    } catch (error) {
      throw new Error(error);
    }
  },
  async syncStripeData(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;

      if (!stripeCustomerId) {
        throw new Error("Stripe customer ID not found for this user.");
      }

      await redisService.syncStripeDataToKV(stripeCustomerId);

      return { success: true };
    } catch (error) {
      throw new Error("Failed to sync Stripe data.");
    }
  },
  async createMemberSubsctiprion(parent, args, ctx, info) {
    try {
      const { email, id, isNewUser } = ctx.dbUser;

      const subscriptionUrl =
        await stripeService.createSubscriptionForNewMember(email, id);

      if (isNewUser) {
        await MemberModel.findByIdAndUpdate(
          ctx.dbUser._id,
          { isNewUser: false },
          { new: true }
        );
      }

      return subscriptionUrl;
    } catch (error) {
      throw new Error(Error);
    }
  },
  async cancelSubscription(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;
      if (!stripeCustomerId) throw new Error("Stripe customer ID not found for this user.");
      await stripeService.cancelMemberSubscription(stripeCustomerId);
      return true;
    } catch {
      throw new Error("Failed to cancel subscription");
    }
  },
  async pauseSubscription(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;
      if (!stripeCustomerId) throw new Error("Stripe customer ID not found for this user.");
      await stripeService.pauseMemberSubscription(stripeCustomerId);
      return true;
    } catch {
      throw new Error("Failed to pause subscription");
    }
  },
  async reactivateSubscription(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;

      if (!stripeCustomerId) {
        throw new Error("Stripe customer ID not found for this user.");
      }

      await stripeService.reactivateMemberSubscription(stripeCustomerId);

      return true;
    } catch {
      throw new Error("Failed to reactivate subscription");
    }
  },

  async followMember(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const targetId = args.memberId;
      if (String(currentMember._id) === String(targetId)) {
        throw new Error("Cannot follow yourself");
      }

      const target = await MemberModel.findById(targetId);
      if (!target) throw new Error("Target member not found");

      // Keep both sides of the relationship in sync atomically
      await Promise.all([
        MemberModel.findByIdAndUpdate(currentMember._id, {
          $addToSet: { following: targetId },
        }),
        MemberModel.findByIdAndUpdate(targetId, {
          $addToSet: { followers: currentMember._id },
        }),
      ]);

      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async unfollowMember(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const targetId = args.memberId;

      await Promise.all([
        MemberModel.findByIdAndUpdate(currentMember._id, {
          $pull: { following: targetId },
        }),
        MemberModel.findByIdAndUpdate(targetId, {
          $pull: { followers: currentMember._id },
        }),
      ]);

      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Member = {
  async clients(parent, args, ctx, info) {
    try {
      const clientIds = ctx.dbUser.clients;
      const clients = await UserModel.find({ _id: { $in: clientIds } });

      return clients;
    } catch (e) {
      throw new Error(e);
    }
  },

  async contracts(parent, args, ctx, info) {
    try {
      const contractIds = ctx.dbUser.contracts;

      const contracts = await ContractModel.find({
        _id: { $in: contractIds },
      });

      return contracts;
    } catch (e) {
      throw new Error(e);
    }
  },
  async products(parent, args, ctx, info) {
    try {
      const products = await ProductsModel.find({
        member: parent._id,
      });
      return products;
    } catch (e) {
      throw new Error(e);
    }
  },
  async qrWidgetData(parent, args, ctx, info) {
    try {
      const { REACT_APP_URL } = process.env;
      const { id, contractsDisabled } = ctx.dbUser;
      const memberConractUrl = `${REACT_APP_URL}/user/new-contract/${id}`;

      const qrImage = await createQRCode(memberConractUrl);
      return {
        url: memberConractUrl,
        image: qrImage,
        contractsDisabled: contractsDisabled 
      };
    } catch (error) {
      throw new Error(error);
    }
  },
  async chats(parent, args, ctx, info) {
    try {
      const { _id } = parent;
      const chats = await ChatModel.find({ memberId: _id });
      return chats;
    } catch (error) {
      throw new Error(error);
    }
  },
  async isSubscribed(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = parent;
      const status = await stripeService.getMemberSubscriptionStatus(
        stripeCustomerId
      );
      return status;
    } catch (error) {
      throw new Error(error);
    }
  },
  async isOnboardedWithStripe(parent, args, ctx, info) {
    try {
      const { stripeConnectAccountId } = parent;

      const result = await stripeService.getOnboardingStatus(
        stripeConnectAccountId
      );

      return result;
    } catch (error) {
      throw new Error(error);
    }
  },

  async following(parent) {
    try {
      if (!parent.following?.length) return [];
      return MemberModel.find({ _id: { $in: parent.following } }).select(
        "firstName lastName businessName state isActive subscriptionStatus"
      );
    } catch (e) {
      throw new Error(e);
    }
  },

  async followers(parent) {
    try {
      if (!parent.followers?.length) return [];
      return MemberModel.find({ _id: { $in: parent.followers } }).select(
        "firstName lastName businessName state isActive subscriptionStatus"
      );
    } catch (e) {
      throw new Error(e);
    }
  },

  async vaultSubmissions(parent) {
    try {
      return VaultModel.find({ memberId: parent._id, deletedAt: null }).sort({ createdAt: -1 });
    } catch (e) {
      throw new Error(e);
    }
  },
};
export default { Query, Mutation, Member };

function buildEmptyMonths() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = date.toLocaleString("default", { month: "short" });
    months.push({ month: monthStr, revenue: 0, newContracts: 0, completed: 0 });
  }
  return months;
}
