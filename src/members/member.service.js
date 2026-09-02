import { memberRepository } from "./member.repository.js";
import { contractRepository } from "../contracts/contract.repository.js";
import { userRepository } from "../users/user.repository.js";
import { chatRepository } from "../chat/chat.repository.js";
import { productRepository } from "../products/product.repository.js";
import * as stripeService from "../stripe/stripe.service";
import * as redisService from "../utils/redis/stripeSubscritpitonCache";
import { createQRCode } from "../utils/qrGenerator";
import { contractStatus } from "../contracts/contract.constants.js";
import { serviceMenuItem } from "./member.constants.js";

export const memberService = {
  async getMembers() {
    return await memberRepository.findAll();
  },

  /**
   * Resolves a member by their Clerk id.
   * Throws a plain domain error that the resolver translates.
   */
  async getCurrentMember(clerkId) {
    const member = await memberRepository.findByClerkId(clerkId);
    if (!member) {
      throw new Error("MEMBER_NOT_FOUND");
    }
    return member;
  },

  /**
   * Pending-payout widget data. Sums pending payouts from the contract
   * ledger (no Stripe balance call), computes percent change vs the most
   * recent paid contract, and enriches with the Stripe account status.
   */
  async getStripeWidgetData(dbUser) {
    const { stripeConnectAccountId, _id: memberId } = dbUser;

    if (!stripeConnectAccountId) {
      throw new Error("Not synced with stripe");
    }

    // Sum all pending payouts from the contract ledger — no Stripe balance call.
    const pendingAgg = await contractRepository.findPendingPayoutsByMember(
      memberId
    );

    const pendingAmount = pendingAgg[0]?.total ?? 0;
    const pendingCount = pendingAgg[0]?.count ?? 0;
    const totalFees = pendingAgg[0]?.totalFees ?? 0;
    const totalGross = pendingAgg[0]?.totalGross ?? 0;

    // Most recent paid contract as the "previous payout" reference.
    const lastPaidContract = await contractRepository.findLatestPaidByMember(
      memberId
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
  },

  async getSubscriptionDetails(stripeCustomerId) {
    return await stripeService.getMemberSubscriptionDetails(stripeCustomerId);
  },

  /**
   * Six-month revenue summary bucketed by month, with empty months filled in.
   */
  async getRevenueSummary(contractIds) {
    if (!contractIds || contractIds.length === 0) {
      const emptyMonths = buildEmptyMonths();
      return { months: emptyMonths, percentChange: 0 };
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const contracts = await contractRepository.findContractsByIdsSince(
      contractIds,
      sixMonthsAgo
    );

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
        .filter((c) => c.status === contractStatus.payoutReleased)
        .reduce((sum, c) => sum + (c.price || 0), 0);

      months.push({
        month: monthStr,
        revenue,
        newContracts: monthContracts.length,
        completed: monthContracts.filter(
          (c) => c.status === contractStatus.payoutReleased
        ).length,
      });
    }

    const lastMonthRev = months[months.length - 1]?.revenue || 0;
    const prevMonthRev = months[months.length - 2]?.revenue || 0;
    const percentChange =
      prevMonthRev > 0
        ? Math.round(((lastMonthRev - prevMonthRev) / prevMonthRev) * 100) / 100
        : 0;

    return { months, percentChange };
  },

  /**
   * Discover feed for a member:
   * - excludes self and already-followed members
   * - scores candidates by community signals:
   *     mutualCount (×3): followers who the current user also follows
   *     followerCount (×1): established presence in the community
   *     isPro (+2): active subscription signals engagement
   * - sorts by score desc then createdAt desc; returns a paginated page.
   * Stage-building lives here (business logic); execution goes through
   * the repository aggregate passthrough.
   */
  async getDiscoverMembers(clerkId, { limit = 10, offset = 0 } = {}) {
    const currentMember = await memberRepository.findByClerkId(clerkId);

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

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          mutualCount: followingIds.length
            ? {
                $size: {
                  $setIntersection: [
                    {
                      $map: {
                        input: "$followers",
                        as: "f",
                        in: { $toString: "$$f" },
                      },
                    },
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
      memberRepository.aggregate([...pipeline, { $count: "total" }]),
      memberRepository.aggregate([
        ...pipeline,
        { $skip: offset },
        { $limit: limit },
      ]),
    ]);

    const totalCount = countResult[0]?.total ?? 0;
    const hasMore = offset + items.length < totalCount;
    const nextOffset = hasMore ? offset + limit : null;

    return { items, totalCount, hasMore, nextOffset };
  },

  /**
   * Creates a new member.
   * - Checks clerkId availability first (domain error CLERK_ID_TAKEN).
   * - Applies defaults (isActive: true).
   */
  async createMember(input) {
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
    } = input;

    const existing = await memberRepository.findByClerkId(clerkId);
    if (existing) {
      throw new Error("CLERK_ID_TAKEN");
    }

    const created = await memberRepository.create({
      email,
      clerkId,
      firstName,
      lastName,
      phoneNumber,
      zipcode,
      addressLineOne,
      addressLineTwo,
      state,
      isActive: true,
    });

    return { ...created._doc, id: created._id };
  },

  async updateMember(memberDbId, updates) {
    await memberRepository.updateById(memberDbId, { ...updates });
    return true;
  },

  /**
   * Soft-deletes a member by their Mongo _id (ctx.dbUser._id — the same
   * id source updateMember uses; ctx.id was unreliable here).
   */
  async deleteMember(memberDbId) {
    await memberRepository.updateById(memberDbId, { deletedAt: Date.now() });
    return true;
  },

  /**
   * Creates an Express account for the current member, persists its id
   * (by Mongo _id), and returns the onboarding link URL.
   */
  async onboardMemberToStripe(clerkId) {
    const createdStripeAccountId = await stripeService.createExpressaccount(
      clerkId
    );
    const member = await memberRepository.findByClerkId(clerkId);
    if (!member) {
      throw new Error("MEMBER_NOT_FOUND");
    }
    await memberRepository.updateById(member._id, {
      stripeConnectAccountId: createdStripeAccountId.id,
    });

    const { url } = await stripeService.createAccountLink(
      createdStripeAccountId.id
    );

    return url;
  },

  async resumeAccountOnboarding(memberDbId) {
    const member = await memberRepository.findById(memberDbId);

    const { url } = await stripeService.createAccountLink(
      member.stripeConnectAccountId
    );

    return url;
  },

  async syncStripeData(stripeCustomerId) {
    if (!stripeCustomerId) {
      throw new Error("STRIPE_CUSTOMER_ID_MISSING");
    }
    await redisService.syncStripeDataToKV(stripeCustomerId);
    return { success: true };
  },

  async createSubscriptionForCurrentMember(dbUser) {
    const { email, id, isNewUser, _id } = dbUser;

    try {
      const subscriptionUrl =
        await stripeService.createSubscriptionForNewMember(email, id);

      if (isNewUser) {
        await memberRepository.updateById(_id, { isNewUser: false });
      }

      return subscriptionUrl;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async cancelSubscription(stripeCustomerId) {
    if (!stripeCustomerId) {
      throw new Error("STRIPE_CUSTOMER_ID_MISSING");
    }
    await stripeService.cancelMemberSubscription(stripeCustomerId);
    return true;
  },

  async pauseSubscription(stripeCustomerId) {
    if (!stripeCustomerId) {
      throw new Error("STRIPE_CUSTOMER_ID_MISSING");
    }
    await stripeService.pauseMemberSubscription(stripeCustomerId);
    return true;
  },

  async reactivateSubscription(stripeCustomerId) {
    if (!stripeCustomerId) {
      throw new Error("STRIPE_CUSTOMER_ID_MISSING");
    }
    await stripeService.reactivateMemberSubscription(stripeCustomerId);
    return true;
  },

  /**
   * Follows a target member after self-follow and existence guards,
   * keeping both sides of the follow graph in sync.
   */
  async followMember(clerkId, targetId) {
    const currentMember = await memberRepository.findByClerkId(clerkId);
    if (!currentMember) throw new Error("MEMBER_NOT_FOUND");

    if (String(currentMember._id) === String(targetId)) {
      throw new Error("Cannot follow yourself");
    }

    const target = await memberRepository.findById(targetId);
    if (!target) throw new Error("TARGET_MEMBER_NOT_FOUND");

    await memberRepository.addFollowerIds(currentMember._id, targetId, "follow");

    return true;
  },

  async unfollowMember(clerkId, targetId) {
    const currentMember = await memberRepository.findByClerkId(clerkId);
    if (!currentMember) throw new Error("MEMBER_NOT_FOUND");

    await memberRepository.addFollowerIds(
      currentMember._id,
      targetId,
      "unfollow"
    );

    return true;
  },

  async getServiceMenu(memberId) {
    const member = await memberRepository.findById(memberId);
    if (!member) throw new Error("MEMBER_NOT_FOUND");
    const menu = member.serviceMenu || [];
    return [...menu].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async upsertServiceMenu(memberId, items) {
    if (!Array.isArray(items)) throw new Error("VALIDATION_ERROR");
    if (items.length > serviceMenuItem.maxItems) throw new Error("VALIDATION_ERROR");
    const normalized = items.map((item, idx) => {
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name || name.length > serviceMenuItem.maxNameLen) throw new Error("VALIDATION_ERROR");
      const price = Number(item.price);
      if (!Number.isFinite(price) || price < 1 || price > 500) throw new Error("VALIDATION_ERROR");
      if (item.description != null && String(item.description).length > 200) throw new Error("VALIDATION_ERROR");
      return {
        id: item.id || new Date().getTime().toString() + "_" + idx,
        name,
        price,
        description: item.description || "",
        isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
        sortOrder: item.sortOrder !== undefined ? Number(item.sortOrder) : idx,
      };
    });
    // normalize sortOrder to sequential index if duplicate or unsorted
    normalized.forEach((it, i) => {
      if (!Number.isFinite(it.sortOrder)) it.sortOrder = i;
    });
    normalized.sort((a, b) => a.sortOrder - b.sortOrder);
    normalized.forEach((it, i) => (it.sortOrder = i));

    const updated = await memberRepository.updateById(memberId, { serviceMenu: normalized });
    if (!updated) throw new Error("MEMBER_NOT_FOUND");
    return normalized;
  },

  // ---- Field-resolver helpers ----

  async getClientsForMember(dbUser) {
    return await userRepository.findByIds(dbUser.clients || []);
  },

  async getContractsForMember(dbUser) {
    return await contractRepository.findByIds(dbUser.contracts || []);
  },

  async getProductsForMember(memberId) {
    return await productRepository.findByMemberId(memberId);
  },

  async getChatsForMember(memberId) {
    return await chatRepository.findChatsByMemberId(memberId);
  },

  async getQrWidgetData(dbUser) {
    const { REACT_APP_URL } = process.env;
    const { id, contractsDisabled } = dbUser;
    const memberConractUrl = `${REACT_APP_URL}/user/new-contract/${id}`;

    const qrImage = await createQRCode(memberConractUrl);
    return {
      url: memberConractUrl,
      image: qrImage,
      contractsDisabled: contractsDisabled,
    };
  },

  async getIsSubscribed(parent) {
    return await stripeService.getMemberSubscriptionStatus(
      parent.stripeCustomerId
    );
  },

  async getIsOnboardedWithStripe(parent) {
    return await stripeService.getOnboardingStatus(
      parent.stripeConnectAccountId
    );
  },

  async getFollowing(parent) {
    if (!parent.following?.length) return [];
    return memberRepository.findMembersByIds(
      parent.following,
      "firstName lastName businessName state isActive subscriptionStatus"
    );
  },

  async getFollowers(parent) {
    if (!parent.followers?.length) return [];
    return memberRepository.findMembersByIds(
      parent.followers,
      "firstName lastName businessName state isActive subscriptionStatus"
    );
  },
};

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
