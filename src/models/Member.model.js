import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firebaseId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    phoneNumber: {
      type: String,
    },
    addressLineOne: {
      type: String,
    },
    addressLineTwo: {
      type: String,
    },
    zipcode: {
      type: String,
    },
    state: {
      type: String,
    },
    clients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
    ],
    contracts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contracts',
      },
    ],
    subscriptionId: {
      type: String,
      default: null,
    },
    stripeConnectAccountId: {
      type: String,
      default: null,
    },
    deletedAt: {
      type: Date, // Use Date type to store the timestamp of deletion
      default: null, // Set to null for active members, or a date value for deleted members
    },
  },
  {
    collection: 'members',
    timestamps: true,
  }
);

module.exports = mongoose.model('Member', MemberSchema);
