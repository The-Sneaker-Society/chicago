import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    phoneNumber: {
      type: String,
    },
    addressLineOne: {
      type: String,
    },
    addressLineTwo: {
      type: String,
    },
    zipcode: {
      type: String,
    },
    state: {
      type: String,
    },
    Members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
      },
    ],
    contracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contracts",
      },
    ],
    userType: {
      type: String,
      default: "USER",
    },
    isNewUser: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date, // Use Date type to store the timestamp of deletion
      default: null, // Set to null for active members, or a date value for deleted members
    },
  },
  {
    collection: "users",
    timestamps: true,
  }
);

module.exports = mongoose.model("user", UserSchema);
