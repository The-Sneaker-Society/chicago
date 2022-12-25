import Stripe from "stripe";
import ProductModel from "../models/Product.model";
import MemberModel from "../models/Member.model";
import { UserInputError } from "apollo-server-core";
const stripe = new Stripe(
  "sk_test_51MEhewEtfRIDf54VFCVLh45XFX6AKm4I4zxoWmswNLmaJEacdUPzWuLgUAVMipvZOS5R80ZK0kNuQSck3aHn3JwE00Ep73AOVu"
);

const Mutation = {
  async createProduct(parent, args, ctx, info) {
    try {
      const { description, price, name, memberId } = args.data;

      // create product on stripse
      const foundMember = await MemberModel.findById(memberId);

      // add product to stripe
      const stripeProduct = await stripe.products.create({
        name,
        description,
        default_price_data: {
          currency: "usd",
          unit_amount: price,
        },
        metadata: {
          createdBy: foundMember.id,
        },
      });

      // add product in DB
      const newProduct = new ProductModel({
        name,
        description,
        member: foundMember,
        price,
        stripeProductId: stripeProduct.id,
      });

      // save product to db
      const res = await newProduct.save();

      // update products on member
      foundMember.products.push(res._id);
      foundMember.save();

      return { ...res._doc, id: res._id };
    } catch (e) {
      throw new Error(e);
    }
  },

  async deleteProduct(parent, args, ctx, info) {
    try {
      const { id } = args;
      // verify product exists
      const product = await ProductModel.findById(id);
      console.log({ product, id });

      if (!product) {
        throw new UserInputError("Product does not exist", {
          errors: {
            product: "Product does not exist",
          },
        });
      }

      //  remove product from member
      await MemberModel.updateOne(
        { id: product.member },
        { $pullAll: { products: [id] } }
      );

      // remove product from db
      await ProductModel.findByIdAndDelete(id);

      // remove product from stripe you actually don't delete you just archive them! - AY
      await stripe.products.update(product.stripeProductId, { active: false });

      // return deleted product
      return product;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Product = {
  async member(parent, args, ctx, info) {
    try {
      const member = await MemberModel.findById(parent.member);
      return member;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Mutation, Product };
