import { UserInputError } from "apollo-server-core";
import UserModel from "../models/User.model";
import MemberModel from "../models/Member.model";
import ContractModel from "../models/Contract.model";
import ChatModel from "../models/Chat.model";

import dotenv from "dotenv";
dotenv.config({ path: "config.env" });

//  test url https://docs.stripe.com/connect/testing

const Query = {
  async test(parent, args, ctx, info) {
    try {
      return "hello";
    } catch (e) {
      throw new Error(e);
    }
  },
  async users(parent, args, ctx, info) {
    try {
      const users = await UserModel.find();
      return users;
    } catch (e) {
      throw new Error(e);
    }
  },
  async currentUser(parent, args, ctx, info) {
    try {
      const user = await UserModel.find({ clerkId: ctx.userId });
      if (!user) {
        throw new Error("user not found");
      }

      return user[0];
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createUser(parent, args, ctx, info) {
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

      const user = await UserModel.findOne({ email: email });

      if (user) {
        throw new UserInputError(
          "Email is taken. If this is wrong please contact support",
          {
            errors: {
              email: "This email is taken.",
            },
          }
        );
      }

      const newUser = new UserModel({
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

      const res = await newUser.save();

      return { ...res._doc, id: res._id };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async updateUser(parent, args, ctx, info) {
    try {
      await UserModel.findByIdAndUpdate(
        ctx.id,
        { ...args.data },
        { new: true }
      );
      return true;
    } catch (error) {
      throw error;
    }
  },
};

const User = {
  async contracts(parent, args, ctx, info) {
    try {
      const contracts = await ContractModel.find();
      return contracts.filter(
        (contract) => contract.client.toString() === parent.id
      );
    } catch (e) {
      throw new Error(e);
    }
  },
  async chats(parent, args, ctx, info) {
    try {
      const { _id } = ctx;
      const chats = await ChatModel.find({ userId: _id });
      return chats;
    } catch (error) {
      throw new Error(error);
    }
  },
};
export default { Query, Mutation, User };
