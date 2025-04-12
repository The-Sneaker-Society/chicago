import redis from "../../config/redis";
import { stripe } from "../../stripe/config";

export async function syncStripeDataToKV(customerId) {
  try {
    console.log(`Syncing user: ${customerId}`);
    // Fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: "all",
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.data.length === 0) {
      const subData = { status: "none" };
      await redis.set(`stripe:customer:${customerId}`, JSON.stringify(subData)); // Stringify for Redis
      return subData;
    }

    const subscription = subscriptions.data[0];

    // Store complete subscription state
    const subData = {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0].price.id,
      currentPeriodEnd: subscription.current_period_end,
      currentPeriodStart: subscription.current_period_start,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod:
        subscription.default_payment_method &&
        typeof subscription.default_payment_method !== "string"
          ? {
              brand: subscription.default_payment_method.card?.brand ?? null,
              last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : null,
    };

    // Store the data in your KV
    await redis.set(`stripe:customer:${customerId}`, JSON.stringify(subData)); // Stringify for Redis
    return subData;
  } catch (error) {
    console.error("Error syncing Stripe data to KV:", error);
    throw error;
  }
}
