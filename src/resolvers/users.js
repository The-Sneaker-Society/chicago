import { UserInputError } from "apollo-server-core";

import { userService } from "../users/user.service.js";

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
      return await userService.getUsers();
    } catch (e) {
      throw new Error(e);
    }
  },
  async currentUser(parent, args, ctx, info) {
    try {
      return await userService.getCurrentUser(ctx.userId);
    } catch (e) {
      if (e.message === "USER_NOT_FOUND") {
        throw new Error("user not found");
      }
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createUser(parent, args, ctx, info) {
    const { clerkId, email } = args.data || {};
    if (!clerkId || !email) {
      throw new UserInputError("clerkId and email are required", {
        errors: {
          email: !email ? "Email is required." : undefined,
          clerkId: !clerkId ? "clerkId is required." : undefined,
        },
      });
    }

    try {
      return await userService.createUser(args.data);
    } catch (error) {
      if (error.message === "EMAIL_TAKEN") {
        throw new UserInputError(
          "Email is taken. If this is wrong please contact support",
          {
            errors: {
              email: "This email is taken.",
            },
          }
        );
      }
      console.error(error);
      throw error;
    }
  },
  async updateUser(parent, args, ctx, info) {
    // ctx.userId is the Clerk id; the service resolves it to the db user id.
    try {
      await userService.updateUser(ctx.userId, { ...args.data });
      return true;
    } catch (error) {
      throw error;
    }
  },
};

const User = {
  async contracts(parent, args, ctx, info) {
    try {
      return await userService.getContractsForUser(parent);
    } catch (e) {
      throw new Error(e);
    }
  },
  async chats(parent, args, ctx, info) {
    try {
      const { _id } = ctx;
      return await userService.getChatsForUser(_id);
    } catch (error) {
      throw new Error(error);
    }
  },
};
export default { Query, Mutation, User };
