import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
  {
    stripeProductId: {
      type: String,
      required: true,
      unique: true,
    },
    stripePriceId: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Members',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Products', ProductSchema, 'products');
