import { clerkClient } from "@clerk/express";
import connectDb from "../config/db";
import MemberModel from "../models/Member.model";

async function deleteClerkMember(email) {
  await connectDb();

  try {
    const foundUser = await MemberModel.findOne({ email: email });

    if (!foundUser) {
      throw new Error(`User Not found: ${email}`);
    }

    const { clerkId, _id } = foundUser;

    await MemberModel.deleteOne({ _id: _id });
    const deletedUser = await clerkClient.users.deleteUser(clerkId);

    console.log(`User ${email} deleted successfully:`, deletedUser);
    process.exit(0);
  } catch (error) {
    console.error(`Error deleting user ${email}:`, error.message);

    // Clerk errors often have more details in error.errors
    if (error.errors) {
      console.error("Clerk error details:", error.errors);
    }
    process.exit(0);
  }
}

deleteClerkMember("alanisyates96@gmail.com");
