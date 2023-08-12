import { stripe } from '../config';
import ProductModel from '../../models/Product.model';

const createPaymentLinkForProduct = async (memberStripeId, productId) => {
  try {
    const foundProduct = await ProductModel.findById(productId);

    if (!foundProduct) {
      throw new Error('Product Does not exist');
    }
    const { default_price } = await stripe.products.retrieve(
      foundProduct.stripeProductId,
      {
        stripeAccount: memberStripeId,
      }
    );

    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [
          {
            price: default_price,
            quantity: 1,
          },
        ],
      },
      {
        stripeAccount: memberStripeId,
      }
    );

    return paymentLink.url;
  } catch (e) {
    throw e;
  }
};

/* 
Get all products by memberId
*/
const getMemberProducts = async () => {
  try {
    // pull he productArray from the member DB.
    return 'done';
  } catch (e) {
    throw e;
  }
};

/* 
Update product by id
*/
const updateProductById = async () => {
  try {
    return 'done';
  } catch (e) {
    throw e;
  }
};

/* 
Delete product by id
*/
const deleteProductById = async () => {
  try {
    return 'done';
  } catch (e) {
    throw e;
  }
};

/* 
Create product for member
*/
export const createProduct = async (
  name,
  description,
  memberId,
  price,
  stripeId
) => {
  try {
    // check if member exists

    // create product with stripe
    const product = await stripe.products.create(
      {
        name,
        description,
        default_price_data: {
          currency: 'usd',
          unit_amount: price,
        },
        metadata: {
          createdBy: memberId,
        },
      },
      { stripeAccount: stripeId }
    );

    // add product to products table MONGO

    // get ID from MongoDB andsave that to the members products array
    // return "done";
    return product;
  } catch (e) {
    throw e;
  }
};

export const stripeService = { createProduct, createPaymentLinkForProduct };
