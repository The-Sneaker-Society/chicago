import mongoose from "mongoose";
import { contractStatus, payoutStatus } from "../contracts/contract.constants.js";

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
    // Human-facing order handle (receipts, support, disputes). Generated
    // at creation as SS-XXXXXX; unique + sparse so pre-number contracts
    // coexist until backfilled.
    orderRef: { type: String, unique: true, sparse: true },
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
        leftSide: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        rightSide: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        topView: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        bottomView: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        frontView: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        backView: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        inside: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        tongue: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        box: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
        other: [{ url: { type: String }, note: { type: String }, key: { type: String }, }],
      },
    },
    repairDetails: {
      clientNotes: { type: String },
      memberNotes: { type: String },
    },
    proposedPrice: { type: Number },
    price: { type: Number },
    // Shipping & Insurance fields
    shippingPreset: { type: String, enum: ["single", "multi"], default: "single" },
    shippingSpeed: { type: String, enum: ["standard", "expedited"], default: "standard" },
    insuranceFee: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    // Explicit opt-out of the auto-applied XCover insurance (review page
    // waiver modal). When true, no `extra.insurance` is sent and no
    // Insurance line_item is charged.
    insuranceDeclined: { type: Boolean, default: false },
    // Signature confirmation (STANDARD) on both labels. Auto-required
    // at/over threshold, opt-in below via review page toggle.
    signatureRequired: { type: Boolean, default: false },
    inboundShipmentId: { type: String },
    outboundShipmentId: { type: String },
    inboundTransactionId: { type: String },
    outboundTransactionId: { type: String },
    inboundLabelUrl: { type: String },
    outboundLabelUrl: { type: String },
    // Checkout-chosen Shippo rates (live rate shopping): bought verbatim
    // post-payment. Service tokens back the stale-rate fallback.
    inboundRateId: { type: String },
    outboundRateId: { type: String },
    inboundServiceToken: { type: String },
    outboundServiceToken: { type: String },
    // Frozen at label-purchase time for the admin evidence viewer
    // (features.md:11). In-flight contracts keep their snapshot even if
    // the member later edits their profile.
    addressSnapshot: { type: mongoose.Schema.Types.Mixed, default: undefined },
    addressMismatch: { type: Boolean, default: undefined },
    status: {
      type: String,
      enum: Object.values(contractStatus),
      default: contractStatus.pendingReview,
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
      enum: Object.values(payoutStatus),
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
    selectedServiceMenuItem: {
      id: { type: String },
      name: { type: String },
      price: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contracts", ContractSchema, "contracts");
