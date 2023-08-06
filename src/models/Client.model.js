import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
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
      required: true,
    },
    lastName: {
      type: String,
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
    isActive: {
      type: Boolean,
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Members',
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
    collection: 'clients',
    timestamps: true,
  }
);

const Client = mongoose.model('Client', clientSchema, 'clients');

export default Client;
