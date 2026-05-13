import { clerkClient } from "@clerk/express";
import connectDb from "../config/db";
import MemberModel from "../models/Member.model";
import UserModel from "../models/User.model";
import ContractModel from "../models/Contract.model";

async function deleteMemberById(memberId) {
  await connectDb();

  try {
    const member = await MemberModel.findById(memberId);
    if (!member) {
      throw new Error(`Member not found: ${memberId}`);
    }

    const { clerkId, email, _id } = member;

    // Remove member reference from all clients
    await UserModel.updateMany(
      { members: _id },
      { $pull: { members: _id, contracts: { $in: member.contracts } } }
    );

    // Delete all contracts belonging to this member
    const contractResult = await ContractModel.deleteMany({ memberId: _id });
    console.log(
      `Deleted ${contractResult.deletedCount} contract(s) for ${email}`
    );

    // Delete member from MongoDB
    await MemberModel.deleteOne({ _id });

    // Delete from Clerk
    const deletedClerkUser = await clerkClient.users.deleteUser(clerkId);
    console.log(`Deleted Clerk user: ${deletedClerkUser.id} (${email})`);

    console.log(`Done. Member ${email} (${memberId}) fully removed.`);
    process.exit(0);
  } catch (error) {
    console.error(`Error deleting member ${memberId}:`, error.message);
    if (error.errors) {
      console.error("Clerk error details:", error.errors);
    }
    process.exit(1);
  }
}

const memberId = process.argv[2];
if (!memberId) {
  console.error("Usage: babel-node src/scripts/deleteMemberById.js <memberId>");
  process.exit(1);
}

deleteMemberById(memberId);
