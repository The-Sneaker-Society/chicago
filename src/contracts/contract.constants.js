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
  inboundLabelGenerated: "INBOUND_LABEL_GENERATED",
  outboundLabelGenerated: "OUTBOUND_LABEL_GENERATED",
  inboundShipped: "INBOUND_SHIPPED",
  inboundDelivered: "INBOUND_DELIVERED",
  unboxingPhotosUploaded: "UNBOXING_PHOTOS_UPLOADED",
  workStarted: "WORK_STARTED",
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
});
