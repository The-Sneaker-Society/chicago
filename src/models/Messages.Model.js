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
    type: {
      type: String,
      enum: ["TEXT", "PRICE_PROPOSAL"],
      default: "TEXT",
    },
    metadata: {
      price: Number,
      checkoutUrl: String,
      checkoutSessionId: String,
      expiresAt: Date,
      status: {
        type: String,
        enum: ["pending", "paid", "expired", "superseded"],
      },
    },
  },
  {
    timestamps: true,
    collection: "messages",
  }
);

module.exports = mongoose.model("Message", MessageSchema);