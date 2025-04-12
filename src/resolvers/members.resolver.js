import dotenv from "dotenv";
import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
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
      const { stripeConnectAccountId } = ctx.dbUser;

      if (!stripeConnectAccountId) {
        throw new Error("Not synced with stripe");
      }
      const { payoutAmount, arrivalDate } =
        await stripeService.getPayoutInfoMember(
          ctx.dbUser.stripeConnectAccountId
        );

      const currentDate = new Date();
      const arrival = new Date(arrivalDate);
      const deltaInMilliseconds = arrival - currentDate;
      const deltaInDays = Math.ceil(
        deltaInMilliseconds / (1000 * 60 * 60 * 24)
      );

      if (!deltaInDays) {
        return {
          stripeConnectAccountId: stripeConnectAccountId ?? "",
          percentChange: 0,
          nextPayoutDays: 0,
          payoutAmount: formattedPayoutAmount ?? "0",
        };
      }

      const formattedPayoutAmount = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(payoutAmount ?? 0 / 100);

      return {
        stripeConnectAccountId: stripeConnectAccountId ?? "",
        percentChange: 0,
        nextPayoutDays: deltaInDays,
        payoutAmount: formattedPayoutAmount ?? "0",
      };
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
      const member = await MemberModel.findById(ctx.id);

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
      const { email, id } = ctx.dbUser;

      const subscriptionUrl =
        await stripeService.createSubscriptionForNewMember(email, id);
      return subscriptionUrl;
    } catch (error) {
      throw new Error(Error);
    }
  },
  async cancelSubscription(parent, args, ctx, info) {
    try {
      const { stripeCustomerId } = ctx.dbUser;

      if (!stripeCustomerId) {
        throw new Error("Stripe customer ID not found for this user.");
      }

      await stripeService.cancelMemberSubscription(stripeCustomerId);

      return true;
    } catch {
      throw new Error("Failed to cancel subscription");
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
      const { CONTRACT_URL } = process.env;
      const { id } = ctx;
      const memberConractUrl = `${CONTRACT_URL}/${id}`;

      const qrImage = await createQRCode(memberConractUrl);
      return {
        url: memberConractUrl,
        image: qrImage,
      };
    } catch (error) {
      throw new Error(error);
    }
  },
  async chats(parent, args, ctx, info) {
    try {
      const { _id } = ctx;
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
};
export default { Query, Mutation, Member };
