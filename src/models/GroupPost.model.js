import mongoose from "mongoose";

const GroupPostCommentSchema = new mongoose.Schema(
  {
    author: {
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
  { timestamps: { createdAt: true, updatedAt: false } },
);

const GroupPostSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    images: [{ type: String }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
    comments: [GroupPostCommentSchema],
  },
  { timestamps: true },
);

GroupPostSchema.index({ groupId: 1, createdAt: -1 });

export default mongoose.model("GroupPost", GroupPostSchema);
