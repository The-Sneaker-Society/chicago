import mongoose from "mongoose";

const EmailSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    subscribed: {
      type: Boolean,
      required: true,
      default: true,
    },
    recieved: {
      type: Array,
      default: [],
    },
  },
  {
    collection: "emails",
    timestamps: true,
  }
);

module.exports = mongoose.model("Email", EmailSchema);
