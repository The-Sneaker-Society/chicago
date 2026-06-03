import mongoose from "mongoose";

const CONTRACT_STATUSES = [
  "PENDING_REVIEW",
  "PRICE_PROPOSED",
  "PRICE_ACCEPTED",
  "WAITING_SHIPMENT",
  "SHIPPED",
  "ARRIVED_AT_MEMBER",
  "WORK_IN_PROGRESS",
  "PROCESSING_RETURN",
  "SHIPPED_BACK",
  "USER_RECEIVED",
  "PAYOUT_RELEASED",
];

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
    declaredMarketValue: { type: Number },
    boxIncluded: { type: Boolean, default: false },
    shoeDetails: {
      brand: { type: String },
      model: { type: String },
      color: { type: String },
      size: { type: String },
      soleCondition: { type: String },
      material: { type: String },
      year: { type: String },
      returnTimeframe: { type: String },
      odorLevel: { type: String },
      previousRepairs: { type: Boolean, default: false },
      previousRepairsNotes: { type: String },
      photos: {
        leftSide: [{ url: { type: String }, note: { type: String } }],
        rightSide: [{ url: { type: String }, note: { type: String } }],
        topView: [{ url: { type: String }, note: { type: String } }],
        bottomView: [{ url: { type: String }, note: { type: String } }],
        frontView: [{ url: { type: String }, note: { type: String } }],
        backView: [{ url: { type: String }, note: { type: String } }],
        inside: [{ url: { type: String }, note: { type: String } }],
        tongue: [{ url: { type: String }, note: { type: String } }],
        box: [{ url: { type: String }, note: { type: String } }],
        other: [{ url: { type: String }, note: { type: String } }],
      },
    },
    repairDetails: {
      clientNotes: { type: String },
      memberNotes: { type: String },
    },
    proposedPrice: { type: Number },
    price: { type: Number },
    status: {
      type: String,
      enum: CONTRACT_STATUSES,
      default: "PENDING_REVIEW",
    },
    inboundTracking: {
      trackingNumber: { type: String },
      carrier: { type: String },
    },
    outboundTracking: {
      trackingNumber: { type: String },
      carrier: { type: String },
    },
    unboxingPhotos: [{ type: String }],
    completionPhotos: [{ type: String }],
    afterFormNotes: { type: String },
    paymentStatus: { type: String },
    stripePaymentIntentId: { type: String },
    stripeTransferId: { type: String },
    payoutStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
    },
    payoutAmount: { type: Number },
    platformFee: { type: Number },
    payoutEligibleAt: { type: Date },
    paidAt: { type: Date },
    timeline: [
      {
        event: { type: String },
        date: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contracts", ContractSchema, "contracts");
