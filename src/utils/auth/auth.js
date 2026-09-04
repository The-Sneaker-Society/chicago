import { clerkClient } from "@clerk/express";
import { userRepository } from "../../users/user.repository";
import { memberRepository } from "../../members/member.repository";

export const clearkAuthorizeUser = async ({ req }) => {
  const { auth } = req;

  if (!auth || !auth.userId) {
    throw new Error("Unauthorized");
  }

  const clerkUser = await clerkClient.users.getUser(auth.userId);

  // Role lives in publicMetadata (migrated from unsafeMetadata), but the
  // user-signup flow only sets unsafeMetadata — accept it as a fallback so
  // brand-new users can reach the provisioning mutations. Frontend login
  // pages already read role with this same precedence. Role alone grants
  // nothing: member/client guards still require the provisioned db row.
  const role = clerkUser.publicMetadata?.role ?? clerkUser.unsafeMetadata?.role;

  if (!role) {
    throw new Error("User role is missing in publicMetadata.");
  }

  // Admins are staff with no Member/User row — missing dbUser is not an error.
  // "admin" is honored from publicMetadata ONLY: unsafeMetadata is
  // client-writable, so accepting admin from it would allow self-escalation.
  if (clerkUser.publicMetadata?.role === "admin") {
    return { userId: auth.userId, role: "admin", dbUser: null };
  }
  if (clerkUser.unsafeMetadata?.role === "admin") {
    throw new Error("User role is missing in publicMetadata.");
  }

  let dbUser = null;

  if (role === "member") {
    dbUser = await memberRepository.findByClerkId(clerkUser.id);
  } else if (role === "client") {
    dbUser = await userRepository.findByClerkId(clerkUser.id);
  } else {
    throw new Error(`Unknown user role: ${role}`);
  }

  // Unprovisioned accounts (signed up via Clerk, no Member/User row yet)
  // get dbUser: null instead of throwing — the createMember/createUser
  // provisioning mutations need a working context to create the row.
  // Fail-closed downstream: requireMember/requireClient still demand dbUser,
  // and getContractsForContext returns [] without one (never all contracts).
  if (!dbUser) {
    return { userId: auth.userId, role, dbUser: null };
  }

  return {
    userId: auth.userId,
    role,
    dbUser,
  };
};
