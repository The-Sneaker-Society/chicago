import dotenv from "dotenv";
dotenv.config({ path: "config.env" });

import { clerkClient } from "@clerk/express";

async function setAdminRole() {
  const target = process.argv[2];

  if (!target) {
    console.error("Usage: npm run make-admin <email-or-clerkUserId>");
    process.exit(1);
  }

  try {
    let user = null;

    if (target.startsWith("user_")) {
      user = await clerkClient.users.getUser(target);
    } else {
      const res = await clerkClient.users.getUserList({
        emailAddress: [target],
      });
      const list = res.data || res;
      if (list.length > 0) {
        user = list[0];
      }
    }

    if (!user) {
      console.error(`User not found in Clerk for: "${target}"`);
      process.exit(1);
    }

    const email = user.emailAddresses?.[0]?.emailAddress || "no-email";
    console.log(`Found Clerk user: ${user.id} (${email})`);

    const nextPublicMetadata = {
      ...(user.publicMetadata || {}),
      role: "admin",
    };

    await clerkClient.users.updateUser(user.id, {
      publicMetadata: nextPublicMetadata,
    });

    console.log(`Successfully granted role: "admin" in publicMetadata to ${email} (${user.id})`);
    process.exit(0);
  } catch (error) {
    console.error("Error setting admin role:", error.message);
    if (error.errors) {
      console.error("Clerk error details:", error.errors);
    }
    process.exit(1);
  }
}

setAdminRole();
