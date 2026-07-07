import mongoose from "mongoose";

const VaultSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["customization", "merchandise", "photo", "video", "other"],
      required: true,
    },
    platforms: {
      type: [String],
      default: [],
    },
    mediaUrls: {
      type: [String],
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "underReview", "approved", "rejected", "published"],
      default: "pending",
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    consentAccepted: {
      type: Boolean,
      required: true,
    },
    adminNotes: {
      type: String,
    },
    moderatedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "vault",
  }
);

VaultSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model("Vault", VaultSchema);
