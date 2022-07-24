import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Members",
        required: true,
      },
    ],
    contracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contracts",
      },
    ],
  },
  {
    collection: "clients",
    timestamps: true,
  }
);

export default mongoose.model("Client", ClientSchema, "clients");
