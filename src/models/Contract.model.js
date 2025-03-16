import mongoose from "mongoose";

const ContractSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Members",
      required: true,
    },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chats" },
    shoeDetails: {
      brand: { type: String },
      model: { type: String },
      color: { type: String },
      size: { type: String },
      soleCondition: { type: String },
      material: { type: String },
      photos: [{ type: String }],
    },
    repairDetails: {
      clientNotes: { type: String },
      memberNotes: { type: String },
    },
    proposedPrice: { type: Number },
    price: { type: Number },
    status: {
      type: String,
    },
    trackingNumber: { type: String },
    shippingCarrier: { type: String },
    paymentStatus: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contracts", ContractSchema, "contracts");
