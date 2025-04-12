import ProductsModel from "../models/Products.model";
import {
  createStripeProduct,
  createSubscriptionForNewMember,
  archiveStripeProduct,
  createPaymentSessionLink,
} from "../stripe/stripe.service";

const Query = {
  async products() {
    try {
      const products = await ProductsModel.find();
      return products;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createProduct(parent, args, ctx, info) {
    const { name, price, description } = args;
    try {
      const createdStripeProduct = await createStripeProduct(
        name,
        description,
        price
      );

      // saving to DB
      await ProductsModel.create({
        name,
        price,
        description,
        member: ctx._id,
        stripeProductId: createdStripeProduct.id,
        stripePriceId: createdStripeProduct.default_price.id,
      });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
  async deleteProductById(parent, args, ctx, info) {
    try {
      const dbProduct = await ProductsModel.findOneAndDelete({ _id: args.id });

      await archiveStripeProduct(dbProduct.stripeProductId);
      return true;
    } catch (e) {
      throw new Error(e);
    }
  },
  async createProductPaymentLink(parent, args, ctx, info) {
    try {
      const { productId } = args;
      const foundProduct = await ProductsModel.findById(productId);

      const paymentLink = await createPaymentSessionLink(
        foundProduct.stripePriceId,
        ctx.stripeConnectAccountId
      );

      return paymentLink;
    } catch (e) {
      throw new Error(e);
    }
  },
};

export default { Query, Mutation };
