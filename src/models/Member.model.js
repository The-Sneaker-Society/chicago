import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema(
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
    stripeId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Products',
      },
    ],
    clients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true,
      },
    ],
    contracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contracts',
      },
    ],
  },
  {
    collection: 'members',
    timestamps: true,
  }
);

module.exports = mongoose.model('Member', MemberSchema);
