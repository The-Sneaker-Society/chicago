import { UserInputError } from "apollo-server-core";
import MemberModel from "../models/Member.model";
import ChatModel from "../models/Chat.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";
import ProductsModel from "../models/Products.model";
import {
  createAccountLink,
  createExpressaccount,
  createSubscriptionForNewMember,
  getPayoutInfoMember,
  signUpForMonthlyMembership,
} from "../stripe/stripeUtils";
import { createQRCode } from "../utils/qrGenerator";
import dotenv from "dotenv";
dotenv.config({ path: "config.env" });

//  test url https://docs.stripe.com/connect/testing

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
      const { payoutAmount, arrivalDate } = await getPayoutInfoMember(
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
  async createMemberSubsctiprion(parent, args, ctx, info) {
    try {
      const { email } = ctx.dbUser;
      const subscriptionUrl = await createSubscriptionForNewMember(email);
      return subscriptionUrl;
    } catch (error) {
      throw new Error(Error);
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
        ctx.id,
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
      const createdStripeAccountId = await createExpressaccount(ctx.userId);
      const member = await MemberModel.findByIdAndUpdate(
        ctx.dbUser.id,
        { stripeConnectAccountId: createdStripeAccountId.id },
        { new: true }
      );

      const { url } = await createAccountLink(member.stripeConnectAccountId);

      return url;
    } catch (error) {
      throw new Error(error);
    }
  },
  async resumeAccountOnboarding(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(ctx.id);

      console.log(member);

      const { url } = await createAccountLink(member.stripeConnectAccountId);

      return url;
    } catch (error) {
      throw new Error(error);
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
};
export default { Query, Mutation, Member };
