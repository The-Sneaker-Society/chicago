import mongoose from "mongoose";
import connectDb from "../config/db";
import ContractModel from "../models/Contract.model";
import ChatModel from "../models/Chat.model";
import MessageModel from "../models/Messages.Model";
import UserModel from "../models/User.model";
import MemberModel from "../models/Member.model";

const CONTRACT_ID = process.argv[2];

if (!CONTRACT_ID) {
  console.error("Usage: babel-node src/scripts/deleteContract.js <contractId>");
  process.exit(1);
}

async function deleteContract() {
  try {
    await connectDb();

    const contract = await ContractModel.findById(CONTRACT_ID);
    if (!contract) {
      console.error(`Contract not found: ${CONTRACT_ID}`);
      process.exit(1);
    }

    const clientId = contract.clientId;
    const memberId = contract.memberId;
    const chatId = contract.chatId;

    if (chatId) {
      const msgResult = await MessageModel.deleteMany({ chatId: String(chatId) });
      console.log(`Deleted ${msgResult.deletedCount} message(s) for chat: ${chatId}`);
      await ChatModel.findByIdAndDelete(chatId);
      console.log(`Deleted chat: ${chatId}`);
    }

    await UserModel.findByIdAndUpdate(clientId, {
      $pull: { contracts: CONTRACT_ID, members: memberId },
    });
    console.log(`Removed contract from user: ${clientId}`);

    await MemberModel.findByIdAndUpdate(memberId, {
      $pull: { contracts: CONTRACT_ID, clients: clientId },
    });
    console.log(`Removed contract from member: ${memberId}`);

    await ContractModel.findByIdAndDelete(CONTRACT_ID);
    console.log(`Deleted contract: ${CONTRACT_ID}`);

    console.log("\nContract and all related data cleaned up successfully.");
  } catch (error) {
    console.error("Error deleting contract:", error);
  } finally {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

deleteContract();
