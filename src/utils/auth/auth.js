import MemberModel from "../../models/Member.model";
import UserModel from "../../models/User.model";
import { clerkClient } from "@clerk/express";

export const clearkAuthorizeUser = async ({ req }) => {
  try {
    const { auth } = req;

    if (!auth || !auth.userId) {
      throw new Error("Unauthorized");
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);

    const role = clerkUser.unsafeMetadata?.role;

    if (!role) {
      throw new Error("User role is missing in metadata.");
    }

    let dbUser = null;

    if (role === "member") {
      dbUser = await MemberModel.findOne({ clerkId: clerkUser.id });
    } else if (role === "client") {
      dbUser = await UserModel.findOne({ clerkId: clerkUser.id });
    }

    if (!dbUser) {
      console.log("Database user was not found");
    }

    return {
      userId: auth.userId,
      role,
      dbUser,
    };
  } catch (error) {
    console.error("Clerk Authorization Error:", error);
    throw error;
  }
};
