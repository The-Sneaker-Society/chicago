import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firebaseID: {
      type: String,
      required: true,
      unique: true,
    },
    userName: {
      type: String,
      required: true,
    },
  },
  {
    collection: "users",
  }
);

module.exports = mongoose.model("User", UserSchema);
