import { UserInputError } from "apollo-server-core";
import UserModel from "../models/User.model";
import MemberModel from "../models/Member.model";
import dotenv from "dotenv";
dotenv.config({ path: "config.env" });

//  test url https://docs.stripe.com/connect/testing

const Query = {
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
        const user = await UserModel.find({ firebaseId: ctx.firebaseId });
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
        email,
        firstName,
        lastName,
        firebaseId,
        phoneNumber,
        zipcode,
        addressLineOne,
        addressLineTwo,
        state,
      } = args.data;

      const member = await MemberModel.findOne({ email: email });
      const user = await UserModel.findOne({ email: email });

      if (member || user) {
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
        firstName,
        lastName,
        firebaseId,
        phoneNumber,
        zipcode,
        addressLineOne,
        addressLineTwo,
        state,
        isActive: true,
      });

      const res = await newUser.save();

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
};

const User = {};
export default { Query, Mutation, User };
