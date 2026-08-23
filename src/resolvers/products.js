import { UserInputError } from "apollo-server-core";

import { productService } from "../products/product.service.js";

const Query = {
  async products(parent, args, ctx, info) {
    try {
      return await productService.getProducts();
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createProduct(parent, args, ctx, info) {
    const { name, price, description } = args;
    try {
      // ctx.dbUser._id is the Mongo id of the authenticated member (owner of
      // the product); it is the aligned id source across domains.
      const memberId = ctx.dbUser._id;

      return await productService.createProduct(memberId, {
        name,
        price,
        description,
      });
    } catch (e) {
      throw new Error(e);
    }
  },
  async deleteProductById(parent, args, ctx, info) {
    try {
      return await productService.deleteProductById(args.id);
    } catch (e) {
      if (e.message === "PRODUCT_NOT_FOUND") {
        throw new UserInputError("product not found");
      }
      throw new Error(e);
    }
  },
  async createProductPaymentLink(parent, args, ctx, info) {
    try {
      const { productId } = args;

      return await productService.createPaymentLink(
        productId,
        ctx.stripeConnectAccountId
      );
    } catch (e) {
      if (e.message === "PRODUCT_NOT_FOUND") {
        throw new UserInputError("product not found");
      }
      throw new Error(e);
    }
  },
};

export default { Query, Mutation };
