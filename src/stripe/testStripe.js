import Stripe from "stripe";
const stripe = new Stripe(
  "sk_test_51MEhewEtfRIDf54VFCVLh45XFX6AKm4I4zxoWmswNLmaJEacdUPzWuLgUAVMipvZOS5R80ZK0kNuQSck3aHn3JwE00Ep73AOVu"
);

export const testStripTransaction = async () => {
  try {
    const customer = await stripe.customers.create({
      description: "My First customer reated with the strip api docs!",
    });
    console.log({ customer });
    return "hello";
  } catch (e) {
    throw e;
  }
};

export const getProducts = async () => {
  try {
    const products = await stripe.products.list({
      limit: 3,
    });
    return products.data;
  } catch (e) {
    throw e;
  }
};

export const createProduct = async () => {
  try {
    const product = await stripe.products.list.name();
    console.log({ products });
  } catch (e) {
    throw e;
  }
};
