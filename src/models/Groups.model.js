import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Group", GroupSchema);
