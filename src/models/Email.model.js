import mongoose from "mongoose";

const EmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  subscribed: {
    type: Boolean,
    required: true,
  },
  recieved: {
    type: Array,
  },
});

module.exports = mongoose.model("Email", EmailSchema);
