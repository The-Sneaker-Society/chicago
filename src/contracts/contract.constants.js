/**
 * Single source of truth for contract vocabularies. Values are the exact
 * strings persisted in Mongo / returned by the API — never change them here
 * without a data migration.
 */

// ─── Contract Statuses (The State Machine) ───────────────────
export const contractStatus = Object.freeze({
  // Negotiation Phase
  pendingReview: "PENDING_REVIEW",
  priceProposed: "PRICE_PROPOSED",
  awaitingPayment: "AWAITING_PAYMENT",

  // Logistics & Custody Phase
  readyToShip: "READY_TO_SHIP",
  inboundShipped: "INBOUND_SHIPPED",
  arrivedAtMember: "ARRIVED_AT_MEMBER",

  // Work Phase
  workInProgress: "WORK_IN_PROGRESS",
  readyForReturn: "READY_FOR_RETURN",
  returnShipped: "RETURN_SHIPPED",
  deliveredToUser: "DELIVERED_TO_USER",

  // Terminal States
  completed: "COMPLETED",
  canceled: "CANCELED",

  // Exception State
  underManualReview: "UNDER_MANUAL_REVIEW",
});

// ─── Timeline Events (The Audit Trail) ───────────────────────
export const contractEvent = Object.freeze({
  contractCreated: "CONTRACT_CREATED",
  chatInitiated: "CHAT_INITIATED",
  priceProposedByMember: "PRICE_PROPOSED_BY_MEMBER",
  priceReproposed: "PRICE_REPROPOSED",
  paymentCompleted: "PAYMENT_COMPLETED",
  shippingSelected: "SHIPPING_SELECTED",
  insuranceDeclined: "INSURANCE_DECLINED",
  inboundLabelGenerated: "INBOUND_LABEL_GENERATED",
  outboundLabelGenerated: "OUTBOUND_LABEL_GENERATED",
  labelGenerationFailed: "LABEL_GENERATION_FAILED",
  inboundShipped: "INBOUND_SHIPPED",
  inboundDelivered: "INBOUND_DELIVERED",
  unboxingPhotosUploaded: "UNBOXING_PHOTOS_UPLOADED",
  packagingPhotosUploaded: "PACKAGING_PHOTOS_UPLOADED",
  workStarted: "WORK_STARTED",
  readyForReturn: "READY_FOR_RETURN",
  returnPackagingPhotosUploaded: "RETURN_PACKAGING_PHOTOS_UPLOADED",
  returnShipped: "RETURN_SHIPPED",
  returnDelivered: "RETURN_DELIVERED",
  reviewWindowOpened: "REVIEW_WINDOW_OPENED",
  payoutReleased: "PAYOUT_RELEASED",
  contractCompleted: "CONTRACT_COMPLETED",
  contractCanceled: "CONTRACT_CANCELED",
  disputeOpened: "DISPUTE_OPENED",
  disputeResolved: "DISPUTE_RESOLVED",
});

// Backwards-compat alias — prefer contractEvent in new code
export const timelineEvent = contractEvent;

// ─── Payout Statuses ─────────────────────────────────────────
export const payoutStatus = Object.freeze({
  pending: "pending",
  paid: "paid",
  canceled: "canceled",
  frozen: "frozen",
});

// ─── Derived Lookups ─────────────────────────────────────────
// Mongo value → camelCase key (useful for the memberContractStatus aggregation)
export const statusToKey = Object.freeze(
  Object.fromEntries(
    Object.entries(contractStatus).map(([k, v]) => [v, k])
  )
);

/**
 * Domain error codes thrown by the contract service and translated to
 * user-facing messages by resolvers.
 */
// ─── Unboxing Evidence Gate (plan-escrow-dispute.md §1) ─────────────
// Minimum unboxing shots to unlock Start Work (sealed-box, open-box,
// shoes-out close-ups). Minimum, not maximum — extra condition close-ups
// stay uploadable after Start Work up to a soft max of 12 (enforced as a
// slice cap in the service, not a constant).
export const UNBOXING_MIN_PHOTOS = 3;

// ─── Platform Fee Configuration ──────────────────────────────
export const platformFee = Object.freeze({
  rate: 0.15, // 15%
});

export const contractErrors = Object.freeze({
  CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  NO_PENDING_PAYOUT: "NO_PENDING_PAYOUT",
  MEMBER_STRIPE_NOT_CONNECTED: "MEMBER_STRIPE_NOT_CONNECTED",
  INVALID_MEMBER_ID: "INVALID_MEMBER_ID",
  SERVICE_MENU_ITEM_NOT_FOUND: "SERVICE_MENU_ITEM_NOT_FOUND",
  SERVICE_MENU_ITEM_INACTIVE: "SERVICE_MENU_ITEM_INACTIVE",
  INVALID_SHIPPING_PRESET: "INVALID_SHIPPING_PRESET",
  INVALID_SHIPPING_SPEED: "INVALID_SHIPPING_SPEED",
  MISSING_SHIPPING_ADDRESS: "MISSING_SHIPPING_ADDRESS",
  CHECKOUT_NOT_ALLOWED: "CHECKOUT_NOT_ALLOWED",
  INSURANCE_OVER_MAX: "INSURANCE_OVER_MAX",
  SHIPPO_NOT_CONFIGURED: "SHIPPO_NOT_CONFIGURED",
  SHIPPO_RATE_UNAVAILABLE: "SHIPPO_RATE_UNAVAILABLE",
  SHIPPO_TRANSACTION_FAILED: "SHIPPO_TRANSACTION_FAILED",
  SHIPPO_BAD_WEBHOOK: "SHIPPO_BAD_WEBHOOK",
  INVALID_SHIPPING_RATE: "INVALID_SHIPPING_RATE",
  ORDER_REF_UNAVAILABLE: "ORDER_REF_UNAVAILABLE",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  BAD_TRANSITION: "BAD_TRANSITION",
  UNBOXING_PHOTOS_REQUIRED: "UNBOXING_PHOTOS_REQUIRED",
  CANCEL_NOT_ALLOWED: "CANCEL_NOT_ALLOWED",
  ALREADY_CANCELED: "ALREADY_CANCELED",
});
