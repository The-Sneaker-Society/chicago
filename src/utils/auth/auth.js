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

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    let dbUser = null;

    if (role === "member") {
      dbUser = await MemberModel.findOne({ clerkId: clerkUser.id });

      if (!dbUser && email) {
        const existingInUserTable = await UserModel.findOne({ email });
        if (existingInUserTable) {
          throw new Error("Email already registered as a client.");
        }

        dbUser = await MemberModel.create({
          clerkId: clerkUser.id,
          email,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
          isActive: true,
        });
        console.log(`Auto-created member for: ${email}`);
      }
    } else if (role === "client") {
      dbUser = await UserModel.findOne({ clerkId: clerkUser.id });

      if (!dbUser && email) {
        const existingInMemberTable = await MemberModel.findOne({ email });
        if (existingInMemberTable) {
          throw new Error("Email already registered as a member.");
        }

        dbUser = await UserModel.create({
          clerkId: clerkUser.id,
          email,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
        });
        console.log(`Auto-created client for: ${email}`);
      }
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
