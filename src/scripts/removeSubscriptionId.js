// import mongoose from "mongoose";
// import connectDb from "../config/db";
// import MemberModel from "../models/Member.model";

// async function removeSubscriptionIdFromMembers() {
//   const fieldToRemove = "subscriptionId"; // Specify the field you want to remove

//   try {
//     await connectDb(); // Establish database connection
//     console.log("Connected to MongoDB");

//     const updateResult = await MemberModel.updateMany(
//       {}, // Empty object to select all documents
//       { $unset: { [fieldToRemove]: 1 } }
//     );
//     console.log("Update Result:", updateResult);
//     console.log(
//       `Successfully removed the field '${fieldToRemove}' from ${updateResult.modifiedCount} members.`
//     );

//     const membersAfterUpdate = await MemberModel.find({
//       subscriptionId: { $exists: true },
//     }).limit(5); // Check a few members after
//     console.log(
//       "Members with subscriptionId after update:",
//       membersAfterUpdate
//     );
//   } catch (error) {
//     console.error(`Error removing the field '${fieldToRemove}':`, error);
//   } finally {
//     mongoose.disconnect(); // Disconnect after the operation
//     console.log("Disconnected from MongoDB");
//   }
// }

// removeSubscriptionIdFromMembers();
