import { authFirebase } from "../firebaseUtils/authFire";
import { AuthenticationError } from "apollo-server-core";
import MemberModel from "../../models/Member.model";
import UserModel from "../../models/User.model";
import { clerkClient, getAuth } from "@clerk/express";

export const clearkAuthorizeUser = async ({ req }) => {
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

  return {
    userId: auth.userId,
    role,
    dbUser,
  };
};

export const authorizeUser = async ({ req }) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    try {
      const token = authHeader.split(" ")[1];

      if (!token) {
        throw new Error("Unauthorized");
      }

      const user = await authFirebase(token);

      // look up user in db
      const dbMember = await MemberModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      const dbUser = await UserModel.find({
        firebaseId: user.uid,
        deletedAt: null,
      });

      // // Need a away to dertimne a Member or User.........
      if (dbMember.length === 0 && dbUser.length === 0) {
        console.log("No member but is verified");
        return;
      }
      return dbMember[0] || dbUser[0];
    } catch (error) {
      throw error;
    }
  } else {
    throw new AuthenticationError("Authorization header not present");
  }
};
