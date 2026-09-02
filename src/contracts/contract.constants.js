/**
 * Single source of truth for contract vocabularies. Values are the exact
 * strings persisted in Mongo / returned by the API — never change them here
 * without a data migration.
 */

export const contractStatus = Object.freeze({
  pendingReview: "PENDING_REVIEW",
  priceProposed: "PRICE_PROPOSED",
  priceAccepted: "PRICE_ACCEPTED",
  waitingShipment: "WAITING_SHIPMENT",
  shipped: "SHIPPED",
  arrivedAtMember: "ARRIVED_AT_MEMBER",
  workInProgress: "WORK_IN_PROGRESS",
  processingReturn: "PROCESSING_RETURN",
  shippedBack: "SHIPPED_BACK",
  userReceived: "USER_RECEIVED",
  payoutReleased: "PAYOUT_RELEASED",
});

export const payoutStatus = Object.freeze({
  pending: "pending",
  paid: "paid",
});

export const timelineEvent = Object.freeze({
  contractCreated: "CONTRACT_CREATED",
  priceProposed: "PRICE_PROPOSED",
  chatInitiated: "CHAT_INITIATED",
  payoutReleased: "PAYOUT_RELEASED",
});

/**
 * Domain error codes thrown by the contract service and translated to
 * user-facing messages by resolvers.
 */
export const contractErrors = Object.freeze({
  CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  NO_PENDING_PAYOUT: "NO_PENDING_PAYOUT",
  MEMBER_STRIPE_NOT_CONNECTED: "MEMBER_STRIPE_NOT_CONNECTED",
});
