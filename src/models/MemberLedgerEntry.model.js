import mongoose from "mongoose";

const MemberLedgerEntrySchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Members",
      required: true,
      index: true,
    },
    // Originating dispute contract (for audit trail + timeline cross-links).
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contracts",
      required: true,
    },
    orderRef: { type: String },
    type: {
      type: String,
      required: true,
    },
    amountCents: {
      type: Number,
      required: true,
      min: 1,
    },
    settledCents: {
      type: Number,
      default: 0,
      min: 0,
    },
    reason: { type: String },
    createdBy: { type: String }, // admin actor (e.g. "admin:<userId>")
    status: {
      type: String,
      default: "OUTSTANDING",
    },
  },
  {
    collection: "member_ledger_entries",
    timestamps: true,
  }
);

export default mongoose.model(
  "MemberLedgerEntry",
  MemberLedgerEntrySchema,
  "member_ledger_entries"
);
