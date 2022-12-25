import Stripe from "stripe";
const stripe = new Stripe(
  "sk_test_51MEhewEtfRIDf54VFCVLh45XFX6AKm4I4zxoWmswNLmaJEacdUPzWuLgUAVMipvZOS5R80ZK0kNuQSck3aHn3JwE00Ep73AOVu"
);
/* 
Get all products by memberId
*/
const getMemberProducts = async () => {
  try {
    // pull he productArray from the member DB.
    return "done";
  } catch (e) {
    throw e;
  }
};

/* 
Update product by id
*/
const updateProductById = async () => {
  try {
    return "done";
  } catch (e) {
    throw e;
  }
};

/* 
Delete product by id
*/
const deleteProductById = async () => {
  try {
    return "done";
  } catch (e) {
    throw e;
  }
};

/* 
Create product for member
*/
export const createProduct = async () => {
  try {
    // check if member exists

    // create product with stripe
    const product = await stripe.products.create({
      name: "Sole Whitening",
      description: "Whiten your soles with top quality products!",
      default_price_data: {
        currency: "usd",
        unit_amount: 3000,
      },
      metadata: {
        createdBy: "this is a mongo db useer id",
      },
    });

    // add product to products table MONGO

    // get ID from MongoDB andsave that to the members products array
    // return "done";
    return product;
  } catch (e) {
    throw e;
  }
};
