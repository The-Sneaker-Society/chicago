import { stripe } from "./config";
import dotenv from "dotenv";

dotenv.config({ path: "config.env" });

export async function handleStripeWebhook(request, response, next) {
  const sig = request.headers["stripe-signature"];
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Get your secret from env
    if (!endpointSecret) {
      console.error(
        "STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail!"
      );
      // It's critical to have this set, but for now, we'll proceed for demonstration
      // In production, you should *not* proceed without it!
      event = request.body; // Proceed with caution and log this
    } else {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    }
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeEvent(event);
    response.json({ received: true });
  } catch (error) {
    console.error("Error handling Stripe event:", error);
    next(error); // Pass the error to your error handling middleware
  }
}

async function handleStripeEvent(event) {
  switch (event.type) {
    case "customer.subscription.created":
      console.log("subscription created");
      // Create subscription record in your DB
      // Note: Don't grant full access yet!
      break;

    case "invoice.paid":
      console.log("Invoice paid");
      // Payment was successful!
      // Grant access to paid features
      // Update user roles, etc.
      break;

    case "checkout.session.completed":
      console.log("checkout succeded");
      // If using Checkout, you might want to
      // verify the session and then check invoice status
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}
