import { syncStripeDataToKV } from "../utils/redis/stripeSubscritpitonCache";
import dotenv from "dotenv";
import { stripe } from "./config";

dotenv.config({ path: "config.env" });

const allowedEvents = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "subscription_schedule.created",
  "subscription_schedule.updated",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
];

export async function handleStripeWebhook(request, response, next) {
  const sig = request.headers["stripe-signature"];
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      console.error(
        "STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail!"
      );
      return response.status(500).send("STRIPE_WEBHOOK_SECRET is not set.");
    }

    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (!allowedEvents.includes(event.type)) {
      console.log(`Skipping event: ${event.type}`);
      return response.json({ received: true });
    }

    await handleStripeEvent(event);
    response.json({ received: true });
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    next(error);
  }
}

async function handleStripeEvent(event) {
  try {
    let customerId;

    // Extract customerId (handle different event structures)
    if (event.data.object.customer) {
      customerId = event.data.object.customer;
    } else if (event.data.object.subscription) {
      customerId = event.data.object.subscription.customer;
    } else if (event.data.object.payment_intent) {
      customerId = event.data.object.payment_intent.customer;
    } else if (event.data.object.invoice) {
      customerId = event.data.object.invoice.customer;
    } else if (event.data.object.checkout) {
      customerId = event.data.object.checkout.customer;
    }

    if (typeof customerId !== "string") {
      console.error(
        `[STRIPE HOOK][CANCER] customerId isn't a string for event: ${event.type}`
      );
      return;
    }

    if (customerId) {
      await syncStripeDataToKV(customerId);
    } else {
      console.warn(
        `[STRIPE HOOK] No customerId found for event: ${event.type}`
      );
    }

    // Additional database updates (if necessary)
    switch (event.type) {
      case "checkout.session.completed":
        // You might want to verify the session and update order status in your DB
        // But the core subscription data is now in KV
        console.log("checkout.session.completed");
        break;

      // Add any other specific DB updates you need here
      default:
        break;
    }
  } catch (error) {
    console.error("Error handling Stripe event:", error);
    throw error; // Propagate the error for handling in the webhook handler
  }
}

// Function to get the raw body (important for signature verification)
async function rawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      console.log(body);
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}
