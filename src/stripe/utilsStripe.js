import Stripe from "stripe";
const stripe = new Stripe(
  "sk_test_51MEhewEtfRIDf54VFCVLh45XFX6AKm4I4zxoWmswNLmaJEacdUPzWuLgUAVMipvZOS5R80ZK0kNuQSck3aHn3JwE00Ep73AOVu"
);

// TO-DO

// New Customers
// delete all prducts for member
// create express member
// update express member
// delete express member
// read express member

export const createSession = async () => {
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: "price_1MHHSUEtfRIDf54V5ZaoEDZY",
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: "https://example.com/success",
    cancel_url: "https://example.com/failure",
    payment_intent_data: {
      application_fee_amount: 123,
      transfer_data: {
        destination: "acct_1MIIBxIKzvH4HPCq",
      },
    },
  });
  return session;
};

export const getAccount = async () => {
  // const accounts = await stripe.accounts.list({
  //   limit: 3,
  // });

  // const capability = await stripe.accounts.retrieveCapability(
  //   "acct_1MHYSTIPz5jyqMFX",
  //   "card_payments"
  // );

  const capability = await stripe.accounts.updateCapability(
    "acct_1MIaDpIOxucS2ZSD",
    "card_payments",
    { requested: true }
  );
  return capability;
};

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

// export const createProduct = async () => {
//   try {
//     const product = await stripe.products.list.name();
//     console.log({ products });
//   } catch (e) {
//     throw e;
//   }
// };
export const createExpressUser = async () => {
  try {
    // const account = await stripe.accounts.create({ type: "express" });
    // const account = await stripe.accounts.create({
    //   type: "custom",
    //   country: "US",
    //   capabilities: {
    //     card_payments: { requested: true },
    //     transfers: { requested: true },
    //   },
    // });

    const accountLink = await stripe.accountLinks.create({
      account: "acct_1MK9AvIiAVgUPtW1",
      refresh_url: "https://example.com/reauth",
      return_url: "https://example.com/return",
      type: "account_onboarding",
    });
    // const verificationSession = await stripe.identity.verificationSessions.create({
    //   type: 'document',
    //   metadata: {
    //     user_id: '{{USER_ID}}',
    //   },
    // });
    // console.log({ account });
    return accountLink;
    // return account;
  } catch (e) {
    throw e;
  }
};

export const acceptTOS = async () => {
  try {
    const account = await stripe.accounts.update("acct_1MIIBxIKzvH4HPCq", {
      tos_acceptance: { date: 1609798905, ip: "8.8.8.8" },
    });
    return account;
  } catch (e) {
    throw e;
  }
};
