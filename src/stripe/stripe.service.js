import { stripe } from "./config";
import MemberModel from "../models/Member.model";
import redis from "../config/redis";
import { syncStripeDataToKV } from "../utils/redis/stripeSubscritpitonCache";

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

export const createExpressaccount = async (userId) => {
  try {
    const stripeAccount = await stripe.accounts.create({
      type: "express",
      metadata: {
        userId: userId,
      },
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

export const createPaymentSessionLink = async (priceId, connectAccountId) => {
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

export const createSubscriptionForNewMember = async (memberEmail, memberId) => {
  try {
    const customer = await stripe.customers.create({
      email: memberEmail,
      metadata: {
        id: memberId,
      },
    });

    const stripeCustomerId = customer.id;

    // sync to redis
    await syncStripeDataToKV(stripeCustomerId);

    await MemberModel.findByIdAndUpdate(
      memberId,
      { stripeCustomerId: stripeCustomerId },
      { new: true }
    );

    const session = await stripe.checkout.sessions.create({
      billing_address_collection: "auto",
      line_items: [
        { price: `${process.env.STRIPE_MEMBER_SUBSCRIPTION_ID}`, quantity: 1 },
      ],
      mode: "subscription",
      success_url: `${process.env.REACT_APP_URL}/member/subscription-success`,
      customer: stripeCustomerId,
      metadata: {
        userId: memberId,
      },
    });

    return session.url;
  } catch (e) {
    console.error("Error creating subscription:", e);
    throw e;
  }
};

export const getPayoutInfoMember = async (connectAccountId) => {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccountId,
    });

    const pendingBalance =
      balance.pending.find((amount) => amount.currency === "usd")?.amount /
        100 || 0;

    const payouts = await stripe.payouts.list(
      {
        limit: 10,
      },
      {
        stripeAccount: connectAccountId,
      }
    );

    if (payouts.data && payouts.data.length > 0) {
      const nextPayout = payouts.data[0];
      const payoutAmount = pendingBalance;
      const arrivalDate = new Date(nextPayout.arrival_date * 1000);

      return {
        payoutAmount: payoutAmount,
        arrivalDate: arrivalDate.toISOString(),
      };
    } else {
      return {
        payoutAmount: 0,
        arrivalDate: null,
      };
    }
  } catch (e) {
    throw e;
  }
};

export const createPaymentIntent = async (
  connectAccountId,
  amount,
  contractId
) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Contract Payment - ${contractId}`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://yourwebsite.com/success",
      cancel_url: "https://yourwebsite.com/cancel",
      payment_intent_data: {
        application_fee_amount: 1200,
        transfer_data: {
          destination: connectAccountId,
        },
        metadata: { contractId: contractId },
      },
    });
    return session.url;
  } catch (error) {
    console.error("Error creating payment intent and checkout session:", error);
    throw error;
  }
};

export const getMemberSubscriptionStatus = async (customerId) => {
  if (!customerId) {
    throw Error("Missing customer Id");
  }

  const kvKey = `stripe:customer:${customerId}`;

  try {
    const stripeData = await redis.get(kvKey);
    if (stripeData) {
      const subData = JSON.parse(stripeData);
      return subData.status === "active";
    }
  } catch (redisError) {
    console.error("Error accessing Redis:", redisError);
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const isActive = subscriptions.data.length > 0;

    if (isActive) {
      // Sync data to KV for next time
      await syncStripeDataToKV(customerId);
    }

    return isActive;
  } catch (stripeError) {
    console.error("Error querying Stripe:", stripeError);
    throw stripeError;
  }
};

export const cancelMemberSubscription = async (customerId) => {
  if (!customerId) {
    throw new Error("Missing customer Id");
  }

  try {
    const kvKey = `stripe:customer:${customerId}`;
    let subscriptionId;
    try {
      const stripeData = await redis.get(kvKey);
      if (stripeData) {
        const subData = JSON.parse(stripeData);
        if (subData.status === "active") {
          subscriptionId = subData.subscriptionId;
        }
      }
    } catch (redisError) {
      console.error("Error accessing Redis:", redisError);
    }

    if (!subscriptionId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          subscriptionId = subscriptions.data[0].id;
        } else {
          throw new Error("No active subscription found to cancel.");
        }
      } catch (stripeError) {
        console.error(
          "Error querying Stripe for active subscription:",
          stripeError
        );
        throw stripeError;
      }
    }

    try {
      const canceledSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      // Sync Stripe data to KV (after successful cancellation)
      await syncStripeDataToKV(customerId);

      return canceledSubscription;
    } catch (stripeCancelError) {
      console.error(
        "Error canceling subscription in Stripe:",
        stripeCancelError
      );
      throw stripeCancelError;
    }
  } catch (error) {
    console.error("Error in cancelMemberSubscription:", error);
    throw error;
  }
};

export const reactivateMemberSubscription = async (customerId, priceId) => {
  if (!customerId) {
    throw new Error("Missing customer Id");
  }

  try {
    const kvKey = `stripe:customer:${customerId}`;
    let subscriptionId;
    let subscriptionStatus;

    try {
      const stripeData = await redis.get(kvKey);
      if (stripeData) {
        const subData = JSON.parse(stripeData);
        subscriptionId = subData.subscriptionId;
        subscriptionStatus = subData.status;
      }
    } catch (redisError) {
      console.error("Error accessing Redis:", redisError);
    }

    if (!subscriptionId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          subscriptionId = subscriptions.data[0].id;
          subscriptionStatus = subscriptions.data[0].status;
        } else {
          throw new Error("No subscription found for this customer.");
        }
      } catch (stripeError) {
        console.error("Error querying Stripe for subscription:", stripeError);
        throw stripeError;
      }
    }

    if (subscriptionStatus === "canceled" || subscriptionStatus === "ended") {
      // Create a new subscription
      const newSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
      });

      await syncStripeDataToKV(customerId);

      return newSubscription;
    } else {
      // Reactivate the existing subscription
      const reactivatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          cancel_at_period_end: false,
        }
      );

      await syncStripeDataToKV(customerId);

      return reactivatedSubscription;
    }
  } catch (error) {
    console.error("Error in reactivateMemberSubscription:", error);
    throw error;
  }
};

export const getMemberSubscriptionDetails = async (customerId) => {
  if (!customerId) {
    throw Error("Missing customer Id");
  }

  const kvKey = `stripe:customer:${customerId}`;

  try {
    const stripeData = await redis.get(kvKey);
    if (stripeData) {
      const subData = JSON.parse(stripeData);
      return {
        status: subData.status,
        currentPeriodEnd: new Date(sub.currentPeriodEnd * 1000).toISOString(),
        paymentMethod: subData.paymentMethod,
      };
    }
  } catch (redisError) {
    console.error("Error accessing Redis:", redisError);
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const subscriptionDetails = {
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        paymentMethod: sub.default_payment_method,
      };

      await syncStripeDataToKV(customerId);

      return subscriptionDetails;
    } else {
      return {
        status: false,
        currentPeriodEnd: null,
        paymentMethod: null,
      };
    }
  } catch (stripeError) {
    console.error("Error querying Stripe:", stripeError);
    throw stripeError;
  }
};
