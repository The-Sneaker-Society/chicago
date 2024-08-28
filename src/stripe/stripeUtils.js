import { stripe } from "./config";

export const getOnboardingStatus = async (customerId) => {
  try {
    const stripeAccount = await stripe.accounts.retrieve(customerId);

    if (stripeAccount.details_submitted) {
      return true;
    }

    return false;
  } catch (error) {
    throw error;
  }
};

export const createExpressaccount = async () => {
  try {
    const stripeAccount = await stripe.accounts.create({
      type: "express",
    });

    return stripeAccount;
  } catch (error) {
    throw error;
  }
};

export const createAccountLink = async (stripeAccountId) => {
  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: "https://example.com/reauth",
      return_url: "https://example.com/return",
      type: "account_onboarding",
    });
    return accountLink;
  } catch (error) {
    throw error;
  }
};

export const createPaymentLink = async (priceId, connectAccountId) => {
  try {
    const paymentLink = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        application_fee_amount: 1050,
        transfer_data: {
          destination: connectAccountId,
        },
      },
      success_url: "https://www.google.com",
      cancel_url: "https://www.google.com/test",
    });
    return paymentLink.url;
  } catch (e) {
    throw e;
  }
};

export const createStripeProduct = async (name, description, price) => {
  try {
    const product = await stripe.products.create({
      name,
      default_price_data: {
        unit_amount: price,
        currency: "usd",
      },
      expand: ["default_price"],
    });
    return product;
  } catch (e) {
    throw e;
  }
};

export const archiveStripeProduct = async (productId) => {
  try {
    await stripe.products.update(productId, {
      active: false,
    });
    return true;
  } catch (e) {
    throw e;
  }
};

export const createSubscriptionForNewMember = async (memberEmail) => {
  const session = await stripe.checkout.sessions.create({
    billing_address_collection: "auto",
    line_items: [{ price: "price_1OlMHZEtfRIDf54VO5sMrS45", quantity: 1 }],
    mode: "subscription",
    success_url: "https://mail.google.com",
  });
  console.log(session);
  return;
};

export const getPayoutInfoMember = async (connectAccountId) => {
  try {
    const payouts = await stripe.payouts.list(
      {
        limit: 1,
      },
      {
        stripeAccount: connectAccountId,
      }
    );

    if (payouts.data.length > 0) {
      const nextPayout = payouts.data[0];
      const payoutAmount = nextPayout.amount;
      const arrivalDate = new Date(nextPayout.arrival_date * 1000);

      return { payoutAmount, arrivalDate };
    } else {
      console.log("No upcoming payouts found.");
      return null;
    }
  } catch (e) {
    throw e;
  }
};
