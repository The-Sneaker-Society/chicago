import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    chatId: {
      type: String,
      required: true,
    },
    senderType: {
      type: String,
      enum: ["MEMBER", "USER"],
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "messages",
  }
);

module.exports = mongoose.model("Message", MessageSchema);