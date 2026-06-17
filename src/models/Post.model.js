import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

const PostSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    mediaUrls: {
      type: [String],
      default: [],
    },
    mediaType: {
      type: String,
      enum: ["none", "image", "video"],
      default: "none",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Member",
      },
    ],
    comments: [CommentSchema],
    shareCount: {
      type: Number,
      default: 0,
    },
    sharedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "posts",
    timestamps: true,
  }
);

// Index for fast feed queries — posts by a set of member IDs, newest first
PostSchema.index({ memberId: 1, createdAt: -1 });

module.exports = mongoose.model("Post", PostSchema);
