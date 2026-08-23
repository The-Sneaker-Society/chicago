import { clerkClient } from "@clerk/express";
import { userRepository } from "../../users/user.repository";
import { memberRepository } from "../../members/member.repository";

export const clearkAuthorizeUser = async ({ req }) => {
  const { auth } = req;

  if (!auth || !auth.userId) {
    throw new Error("Unauthorized");
  }

  const clerkUser = await clerkClient.users.getUser(auth.userId);

  // Role lives in publicMetadata (migrated from unsafeMetadata).
  const role = clerkUser.publicMetadata?.role;

  if (!role) {
    throw new Error("User role is missing in publicMetadata.");
  }

  // Admins are staff with no Member/User row — missing dbUser is not an error.
  if (role === "admin") {
    return { userId: auth.userId, role: "admin", dbUser: null };
  }

  let dbUser = null;

  if (role === "member") {
    dbUser = await memberRepository.findByClerkId(clerkUser.id);
  } else if (role === "client") {
    dbUser = await userRepository.findByClerkId(clerkUser.id);
  } else {
    throw new Error(`Unknown user role: ${role}`);
  }

  // Fail fast: a known role without a provisioned db row is a provisioning bug.
  if (!dbUser) {
    throw new Error(`No ${role} record provisioned for this account`);
  }

  return {
    userId: auth.userId,
    role,
    dbUser,
  };
};
