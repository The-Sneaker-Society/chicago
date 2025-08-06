import { clerkClient } from "@clerk/express";
import connectDb from "../config/db";
import MemberModel from "../models/Member.model";

async function deleteAllClerkUsers() {
  // No need to connect to MongoDB

  try {
    // Fetch all Clerk users (paginated)
    let users = [];
    let offset = 0;
    const limit = 100;
    let page;

    do {
      page = await clerkClient.users.getUserList({ limit, offset });
      users = users.concat(page);
      offset += limit;
    } while (page.length === limit);

    if (users.length === 0) {
      console.log("No Clerk users found.");
      process.exit(0);
    }

    for (const user of users) {
      try {
        // Delete from Clerk only
        await clerkClient.users.deleteUser(user.id);
        console.log(`Deleted Clerk user: ${user.id}`);
      } catch (err) {
        console.error(`Error deleting user ${user.id}:`, err.message);
      }
    }

    console.log(`Deleted ${users.length} Clerk users.`);
    process.exit(0);
  } catch (error) {
    console.error("Error deleting Clerk users:", error.message);
    if (error.errors) {
      console.error("Clerk error details:", error.errors);
    }
    process.exit(1);
  }
}

deleteAllClerkUsers();
