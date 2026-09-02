import {
  createStripeProduct,
  archiveStripeProduct,
  createPaymentSessionLink,
} from "../stripe/stripe.service";

import { productRepository } from "./product.repository.js";

export const productService = {
  async getProducts() {
    return await productRepository.findAll();
  },

  /**
   * Throws a plain domain error that the resolver translates.
   */
  async getProductById(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    return product;
  },

  /**
   * Creates the Stripe product/price first, then persists the local record.
   * `memberId` is the Mongo _id of the authenticated member (ctx.dbUser._id)
   * and is stored as the product owner.
   */
  async createProduct(memberId, { name, price, description }) {
    const createdStripeProduct = await createStripeProduct(
      name,
      description,
      price
    );

    const created = await productRepository.create({
      name,
      price,
      description,
      member: memberId,
      stripeProductId: createdStripeProduct.id,
      stripePriceId: createdStripeProduct.default_price.id,
    });

    return !!created;
  },

  /**
   * Archives the Stripe product only if a matching product exists, then deletes it.
   * Throws PRODUCT_NOT_FOUND instead of dereferencing a missing doc.
   */
  async deleteProductById(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    await archiveStripeProduct(product.stripeProductId);
    await productRepository.deleteById(id);

    return true;
  },

  /**
   * Looks up the product and builds a Stripe Checkout payment link for its price.
   * Throws PRODUCT_NOT_FOUND if the id doesn't resolve.
   */
  async createPaymentLink(productId, stripeConnectAccountId) {
    const foundProduct = await productRepository.findById(productId);
    if (!foundProduct) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    return await createPaymentSessionLink(
      foundProduct.stripePriceId,
      stripeConnectAccountId
    );
  },

  /**
   * Field-resolver-style helper: products owned by the given member.
   */
  async getProductsForMember(memberId) {
    return await productRepository.findByMemberId(memberId);
  },
};
