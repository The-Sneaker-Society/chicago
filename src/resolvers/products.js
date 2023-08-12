import { stripe } from '../stripe/config';
import ProductModel from '../models/Product.model';
import MemberModel from '../models/Member.model';
import { UserInputError } from 'apollo-server-core';
import { stripeService } from '../stripe/products/productUtlis';

const Mutation = {
  /**
   * Create a new product and store it in the database and Stripe.
   * @param {Object} parent - The parent object.
   * @param {Object} args - The arguments for creating the product.
   * @param {Object} args.data - Data for the new product.
   * @param {string} args.data.description - Description of the product.
   * @param {number} args.data.price - Price of the product.
   * @param {string} args.data.name - Name of the product.
   * @param {string} args.data.memberId - ID of the member associated with the product.
   * @param {Object} ctx - The context object.
   * @param {Object} info - Additional information about the operation.
   * @returns {Object} - The created product.
   * @throws {Error} - If there's an error during the creation process.
   */
  async createProduct(parent, args, ctx, info) {
    try {
      const { description, price, name, memberId } = args.data;

      const foundMember = await MemberModel.findById(memberId);

      const stripeProduct = await stripeService.createProduct(
        name,
        description,
        memberId,
        price,
        foundMember.stripeId
      );

      const newProduct = new ProductModel({
        name,
        description,
        member: foundMember,
        price,
        stripeProductId: stripeProduct.id,
      });

      const res = await newProduct.save();

      foundMember.products.push(res._id);
      foundMember.save();

      return { ...res._doc, id: res._id };
    } catch (e) {
      throw new Error(e);
    }
  },

  async createPaymentLink(parent, args, ctx, info) {
    try {
      const { productId, stripeId } = args.data;

      // const foundProduct = await ProductModel.findById(productId);

      // if (!foundProduct) {
      //   throw new Error('Product Does not exist');
      // }

      // const {default_price} = await stripe.

      const url = await stripeService.createPaymentLinkForProduct(
        stripeId,
        productId
      );

      return { url };
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
        throw new UserInputError('Product does not exist', {
          errors: {
            product: 'Product does not exist',
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
