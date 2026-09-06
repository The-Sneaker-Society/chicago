import { syncStripeDataToKV } from "../utils/redis/stripeSubscritpitonCache";
import dotenv from "dotenv";
import { stripe } from "./config";
import ContractModel from "../models/Contract.model";
import MessageModel from "../models/Messages.Model";
import pubsub from "../pubsub";
import { contractStatus, contractEvent, payoutStatus } from "../contracts/contract.constants.js";
import { shippingService } from "../shipping/shipping.service.js";
import { shippingRepository } from "../shipping/shipping.repository.js";

dotenv.config({ path: "config.env" });

const PLATFORM_FEE_CENTS = 1200; // $12 platform fee per contract — fallback only, see handleContractPayment

const allowedEvents = [
  "checkout.session.completed",
  "checkout.session.expired",
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

async function expireProposal(checkoutSessionId) {
  const msg = await MessageModel.findOneAndUpdate(
    { "metadata.checkoutSessionId": checkoutSessionId },
    { "metadata.status": "expired" },
    { new: true },
  );
  if (msg) {
    pubsub.publish(`MESSAGE_UPDATED ${msg.chatId}`, {
      messageUpdated: {
        id: msg._id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        content: msg.content,
        senderType: msg.senderType,
        type: msg.type,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
      },
    });
  }
}

async function handleStripeEvent(event) {
  try {
    // --- Contract payment branch ---
    // A checkout session with a contractId in metadata is a one-time contract
    // payment — not a subscription event. Handle it separately before any
    // customerId-based subscription sync.
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.contractId) {
        await handleContractPayment(session);
        return;
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      if (session.id) await expireProposal(session.id);
    }

    if (event.type === "payment_intent.canceled") {
      const pi = event.data.object;
      if (pi.id) {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: pi.id, limit: 1 });
        const session = sessions.data[0];
        if (session?.id) await expireProposal(session.id);
      }
    }

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
        // TODO Updatefor subscription created success and update in DB
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

// Handles a completed Stripe Checkout session for a contract payment.
// Funds land in the platform account. The contract is marked READY_TO_SHIP and
// payoutStatus set to pending until the member manually triggers releasePayout.
// The platform fee is read from session metadata (set by createPaymentIntent at
// session creation time) so that DB and Stripe share the same source of truth.
// Falls back to PLATFORM_FEE_CENTS for legacy sessions missing the metadata field.
//
// Idempotent: Stripe retries a 500'd webhook with the same payment_intent.
// A repeat delivery skips the payment update and only ensures labels exist,
// so retries can never double-charge math or duplicate labels.
async function handleContractPayment(session) {
  const { contractId, platformFeeCents, stripeConnectAccountId } = session.metadata;
  const feeCents = parseInt(platformFeeCents, 10) || PLATFORM_FEE_CENTS;

  const alreadyPaid = await ContractModel.findById(contractId).select(
    "paymentStatus stripePaymentIntentId"
  );
  if (
    alreadyPaid?.paymentStatus === "paid" &&
    alreadyPaid?.stripePaymentIntentId === session.payment_intent
  ) {
    console.log(`[STRIPE HOOK] Contract ${contractId} already processed — ensuring labels only.`);
    await ensureLabels(contractId);
    return;
  }

  const payoutAmount = await computePayoutAmount(session, feeCents);
  const platformFee = feeCents / 100;
  const taxFee = (session.total_details?.amount_tax || 0) / 100;

  await ContractModel.findByIdAndUpdate(contractId, {
    stripePaymentIntentId: session.payment_intent,
    paymentStatus: "paid",
    status: contractStatus.readyToShip,
    payoutStatus: payoutStatus.pending,
    payoutAmount,
    platformFee,
    taxFee,
    $push: { timeline: { event: contractEvent.paymentCompleted, date: new Date() } },
  });

  // Mark the proposal message as paid
  const updatedMessage = await MessageModel.findOneAndUpdate(
    { "metadata.checkoutSessionId": session.id },
    { "metadata.status": "paid" },
    { new: true },
  );

  if (updatedMessage) {
    pubsub.publish(`MESSAGE_UPDATED ${updatedMessage.chatId}`, {
      messageUpdated: {
        id: updatedMessage._id,
        chatId: updatedMessage.chatId,
        senderId: updatedMessage.senderId,
        content: updatedMessage.content,
        senderType: updatedMessage.senderType,
        type: updatedMessage.type,
        metadata: updatedMessage.metadata,
        createdAt: updatedMessage.createdAt,
      },
    });
  }

  console.log(`[STRIPE HOOK] Contract ${contractId} payment received. Payout pending: $${payoutAmount}`);

  await ensureLabels(contractId);
}

// The member earns service minus the platform fee ONLY. Shipping,
// insurance, and sales tax collections belong to the platform (postage
// + labels fund Shippo; tax is a government liability) and must never
// inflate the payout. Legacy service-only sessions persist no fees, so
// their math is unchanged.
export async function computePayoutAmount(session, feeCents) {
  const { contractId } = session.metadata;
  const contractFees = await ContractModel.findById(contractId).select(
    "shippingFee insuranceFee"
  );
  const shipCents = Math.round((contractFees?.shippingFee || 0) * 100);
  const insCents = Math.round((contractFees?.insuranceFee || 0) * 100);
  const taxCents = session.total_details?.amount_tax || 0;
  return (session.amount_total - feeCents - shipCents - insCents - taxCents) / 100;
}

// Shippo labels (plan-shipping.md §2.5): purchase inbound + outbound labels
// sequentially. Failures never roll back payment — the contract stays
// READY_TO_SHIP with a LABEL_GENERATION_FAILED event and a log-stub
// notification (no provider, no retry mutation in this PR). Legs that
// already have labels are skipped so webhook retries can't buy duplicates.
export async function ensureLabels(contractId) {
  try {
    const fullContract = await ContractModel.findById(contractId);
    if (!fullContract || fullContract.status === contractStatus.canceled) {
      return;
    }
    for (const leg of ["inbound", "outbound"]) {
      // Re-verify contract was not canceled during prior leg generation
      const freshContract = await ContractModel.findById(contractId).select("status");
      if (freshContract?.status === contractStatus.canceled) {
        return;
      }
      const existingId =
        leg === "inbound" ? fullContract.inboundShipmentId : fullContract.outboundShipmentId;
      if (existingId) {
        console.log(`[SHIPPING_SKIP] contract ${contractId} leg ${leg}: already labeled`);
        continue;
      }
      try {
        const label =
          leg === "inbound"
            ? await shippingService.createInboundLabel(fullContract)
            : await shippingService.createOutboundLabel(fullContract);
        await shippingRepository.saveLabels(contractId, leg, label);
      } catch (err) {
        await shippingRepository.pushTimeline(contractId, contractEvent.labelGenerationFailed);
        console.log(`[SHIPPING_FAIL] contract ${contractId} leg ${leg}: ${err.message}`);
      }
    }
    if (!fullContract.addressSnapshot) {
      try {
        const { snapshot, addressMismatch } =
          await shippingService.snapshotAddresses(fullContract);
        await shippingRepository.saveAddressSnapshot(contractId, snapshot, addressMismatch);
      } catch (err) {
        console.log(`[SHIPPING_SNAPSHOT_FAIL] contract ${contractId}: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`[SHIPPING_FAIL] contract ${contractId}: ${err.message}`);
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
