import mongoose from "mongoose";
import connectDb from "../config/db";
import MemberModel from "../models/Member.model";

async function updateMemberModel() {
  try {
    await connectDb(); // Establish database connection

    // Fetch all existing members
    const members = await MemberModel.find({});
    console.log(`Found ${members.length} members to update.`);

    let updateCount = 0;
    for (const member of members) {
      const updateObject = {};

      // Add the new 'stripeCustomerId' field if it doesn't exist
      if (member.stripeCustomerId === undefined) {
        updateObject.stripeCustomerId = null; // Set a default value
      }

        // Add the new 'subscriptionStatus' field if it doesn't exist
        if (!member.subscriptionStatu ) {
          updateObject.subscriptionStatus = "inactive"; // Set the default value
        }

      // If there are any updates to apply
      if (Object.keys(updateObject).length > 0) {
        await MemberModel.updateOne(
          { _id: member._id },
          { $set: updateObject }
        );
        console.log(
          `Updated member with email: ${member.email} - Added new fields.`
        );
        updateCount++;
      } else {
        console.log(
          `No updates needed for member with email: ${member.email}.`
        );
      }
    }

    console.log(
      `Successfully updated ${updateCount} members to the new schema.`
    );
    return;
  } catch (error) {
    console.error("Error updating members:", error);
  } finally {
    mongoose.disconnect(); // Disconnect after the operation
    console.log("Disconnected from MongoDB");
  }
}

updateMemberModel();
