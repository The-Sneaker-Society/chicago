import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema({
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
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Members",
    required: true,
  },
},{
  collection: "clients",
});

export default mongoose.model("Client", ClientSchema, "clients");
