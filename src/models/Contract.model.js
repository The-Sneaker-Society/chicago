import mongoose from "mongoose";

const ContractSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clients",
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Members",
      required: true,
    },
    eta: {
      type: String,
      required: true,
    },
    stage: {
      type: String,
      required: true,
    },
    price: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      required: true,
    },
    reported: {
      type: Boolean,
      required: true,
    },
    photos: {
      type: Array,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contracts", ContractSchema, "contracts");
