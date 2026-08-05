import dotenv from "dotenv";
import { stripe } from "./config";

const PLATFORM_FEE_CENTS = 1200; // $12 platform fee per contract
import MemberModel from "../models/Member.model";
import redis from "../config/redis";
import { syncStripeDataToKV } from "../utils/redis/stripeSubscritpitonCache";
dotenv.config({ path: "config.env" });

export const getOnboardingStatus = async (stripeConnectAccountId) => {
  if (!stripeConnectAccountId) {
    return false;
  }

  try {
    const account = await stripe.accounts.retrieve(stripeConnectAccountId);

    const { payouts_enabled, details_submitted, requirements } = account;

    const hasNoCurrentlyDueRequirements = !(
      requirements &&
      requirements.currently_due &&
      requirements.currently_due.length > 0
    );

    return (
      payouts_enabled && details_submitted && hasNoCurrentlyDueRequirements
    );
  } catch (error) {
    console.error(
      `Error in getOnboardingStatus for Stripe account ${stripeConnectAccountId}:`,
      error.message
    );
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
  const { REACT_APP_URL } = process.env;
  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${REACT_APP_URL}/member/onboarding`,
      return_url: `${REACT_APP_URL}/member/onboarding`,
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

export const getPayoutSchedule = async (connectAccountId) => {
  try {
    const account = await stripe.accounts.retrieve(connectAccountId);

    const payoutSchedule = account.settings.payouts.schedule;

    return {
      interval: payoutSchedule.interval,
      delayDays: payoutSchedule.delay_days,
    };
  } catch (error) {
    console.error("Error retrieving payout schedule:", error);
    throw error;
  }
};

export const getNextPayoutDate = async (connectAccountId) => {
  try {
    // Retrieve the payout schedule
    const payoutSchedule = await getPayoutSchedule(connectAccountId);
    const { interval, delayDays } = payoutSchedule;

    // Retrieve the last payout date
    const payouts = await stripe.payouts.list(
      { limit: 1 },
      { stripeAccount: connectAccountId }
    );

    const lastPayoutDate = payouts.data.length
      ? new Date(payouts.data[0].arrival_date * 1000)
      : new Date(); // Default to current date if no payouts exist

    let nextPayoutDate;

    if (interval === "daily") {
      // Add delay days to the last payout date for daily payouts
      nextPayoutDate = new Date(lastPayoutDate);
      nextPayoutDate.setDate(lastPayoutDate.getDate() + delayDays);
    } else if (interval === "weekly") {
      // Calculate the next weekly payout date
      const dayOfWeek = lastPayoutDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysUntilNextPayout = (7 - dayOfWeek + delayDays) % 7 || 7;
      nextPayoutDate = new Date(lastPayoutDate);
      nextPayoutDate.setDate(lastPayoutDate.getDate() + daysUntilNextPayout);
    } else if (interval === "monthly") {
      // Assume monthly payouts occur on the same day of the month
      nextPayoutDate = new Date(lastPayoutDate);
      nextPayoutDate.setMonth(lastPayoutDate.getMonth() + 1);
      nextPayoutDate.setDate(delayDays || 1); // Default to the 1st of the month if no delayDays
    } else {
      throw new Error("Unsupported payout interval");
    }

    return {
      nextPayoutDate: nextPayoutDate.toISOString(),
      lastPayoutDate: lastPayoutDate.toISOString(),
      interval,
      delayDays,
    };
  } catch (error) {
    console.error("Error calculating next payout date:", error);
    throw error;
  }
};

export const getPayoutInfoMember = async (connectAccountId) => {
  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccountId,
    });

    const pendingBalance = balance.pending.reduce((acc, item) => {
      return acc + item.amount;
    }, 0);
    const payoutData = await getNextPayoutDate(connectAccountId);

    return {
      payoutAmount: pendingBalance / 100,
      arrivalDate: payoutData.nextPayoutDate,
    };
  } catch (e) {
    console.error("Error fetching payout info:", e);
    throw e;
  }
};

export const getPreviousPayoutAmount = async (connectAccountId) => {
  try {
    const payouts = await stripe.payouts.list(
      { limit: 2, status: "paid" },
      { stripeAccount: connectAccountId }
    );

    if (payouts.data.length > 0) {
      const amount = payouts.data[0].amount / 100;
      return {
        formatted: new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount),
        raw: amount,
      };
    }

    return { formatted: null, raw: null };
  } catch (e) {
    console.error("Error fetching previous payout:", e);
    return { formatted: null, raw: null };
  }
};

export const getAccountStatus = async (connectAccountId) => {
  try {
    const account = await stripe.accounts.retrieve(connectAccountId);
    const { payouts_enabled, details_submitted, requirements } = account;

    if (!details_submitted) return "pending";
    if (requirements?.currently_due?.length > 0) return "restricted";
    if (!payouts_enabled) return "restricted";
    return "active";
  } catch (e) {
    return "unknown";
  }
};

export const createPaymentIntent = async (
  connectAccountId,
  amount,
  contractId,
  productName
) => {
  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName || `Contract Payment - ${contractId}`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      success_url: `${process.env.REACT_APP_URL}/member/contracts`,
      cancel_url: `${process.env.REACT_APP_URL}/member/contracts`,
      // Funds land in the platform account — no transfer_data or application_fee_amount.
      // Payout to the member is triggered manually via releasePayout after work is done.
      // Platform fee is embedded in metadata so the webhook reads it off the Stripe session,
      // keeping the DB + Stripe in sync.
      metadata: { contractId, platformFeeCents: String(PLATFORM_FEE_CENTS), stripeConnectAccountId: connectAccountId },
      payment_intent_data: {
        metadata: { contractId, platformFeeCents: String(PLATFORM_FEE_CENTS), stripeConnectAccountId: connectAccountId },
      },
    });
    return { url: session.url, id: session.id, expiresAt: new Date(session.expires_at * 1000) };
  } catch (error) {
    console.error("Error creating payment intent and checkout session:", error);
    throw error;
  }
};

export const releasePayoutToMember = async (
  connectAccountId,
  amountCents,
  contractId
) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: connectAccountId,
      metadata: { contractId },
    });
    return transfer;
  } catch (error) {
    console.error("Error releasing payout to member:", error);
    throw error;
  }
};

export const getMemberSubscriptionStatus = async (customerId) => {
  if (!customerId) {
    console.error("Missing customer Id");
    return false;
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

    let isPaused = false;

    try {
      const stripeData = await redis.get(kvKey);
      if (stripeData) {
        const subData = JSON.parse(stripeData);
        subscriptionId = subData.subscriptionId;
        subscriptionStatus = subData.status;
        isPaused = !!subData.isPaused;
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
          const sub = subscriptions.data[0];
          subscriptionId = sub.id;
          subscriptionStatus = sub.status;
          isPaused = !!sub.pause_collection;
        } else {
          throw new Error("No subscription found for this customer.");
        }
      } catch (stripeError) {
        console.error("Error querying Stripe for subscription:", stripeError);
        throw stripeError;
      }
    }

    if (subscriptionStatus === "canceled" || subscriptionStatus === "ended") {
      // Create a brand-new subscription
      const newSubscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
      });

      await syncStripeDataToKV(customerId);

      return newSubscription;
    } else if (isPaused) {
      // Remove pause_collection to resume billing
      const reactivatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { pause_collection: "" }
      );

      await syncStripeDataToKV(customerId);

      return reactivatedSubscription;
    } else {
      // Undo a scheduled cancellation
      const reactivatedSubscription = await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: false }
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
        currentPeriodEnd: new Date(subData.currentPeriodEnd * 1000).toISOString(),
        paymentMethod: subData.paymentMethod ?? null,
        cancelAtPeriodEnd: subData.cancelAtPeriodEnd ?? false,
        isPaused: subData.isPaused ?? false,
      };
    }
  } catch (redisError) {
    console.error("Error accessing Redis:", redisError);
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const pm = sub.default_payment_method;

      const subscriptionDetails = {
        status: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        paymentMethod:
          pm && typeof pm !== "string"
            ? { brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null }
            : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        isPaused: !!sub.pause_collection,
      };

      await syncStripeDataToKV(customerId);

      return subscriptionDetails;
    } else {
      return {
        status: false,
        currentPeriodEnd: null,
        paymentMethod: null,
        cancelAtPeriodEnd: false,
        isPaused: false,
      };
    }
  } catch (stripeError) {
    console.error("Error querying Stripe:", stripeError);
    throw stripeError;
  }
};

export const pauseMemberSubscription = async (customerId) => {
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
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (subscriptions.data.length === 0) {
        throw new Error("No active subscription found to pause.");
      }
      subscriptionId = subscriptions.data[0].id;
    }

    // pause_collection voids future invoices — no proration, no mid-period charge.
    // Since the current period is already paid, the member keeps full access until
    // their billing date, then billing stops until they reactivate.
    await stripe.subscriptions.update(subscriptionId, {
      pause_collection: { behavior: "void" },
    });

    await syncStripeDataToKV(customerId);

    return true;
  } catch (error) {
    console.error("Error in pauseMemberSubscription:", error);
    throw error;
  }
};
