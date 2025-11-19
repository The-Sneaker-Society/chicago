import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    avatar: {
      type: String,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "groups",
    timestamps: true,
  }
);

export default mongoose.model("Groups", GroupSchema, "groups");
