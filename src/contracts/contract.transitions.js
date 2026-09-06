import { contractStatus, contractErrors } from "./contract.constants.js";

/**
 * Valid contract state transitions.
 * Canonical terminal states are CANCELED and COMPLETED.
 */
export const TRANSITIONS = Object.freeze({
  [contractStatus.pendingReview]: [contractStatus.priceProposed, contractStatus.canceled],
  [contractStatus.priceProposed]: [contractStatus.priceProposed, contractStatus.awaitingPayment, contractStatus.canceled],
  [contractStatus.awaitingPayment]: [contractStatus.priceProposed, contractStatus.readyToShip, contractStatus.canceled],
  [contractStatus.readyToShip]: [contractStatus.inboundShipped, contractStatus.canceled],
  [contractStatus.inboundShipped]: [contractStatus.arrivedAtMember, contractStatus.underManualReview],
  [contractStatus.arrivedAtMember]: [contractStatus.workInProgress, contractStatus.returnShipped, contractStatus.underManualReview],
  [contractStatus.workInProgress]: [contractStatus.returnShipped, contractStatus.underManualReview],
  [contractStatus.returnShipped]: [contractStatus.deliveredToUser, contractStatus.underManualReview],
  [contractStatus.deliveredToUser]: [contractStatus.completed, contractStatus.underManualReview],
  [contractStatus.underManualReview]: [
    contractStatus.canceled,
    contractStatus.completed,
    contractStatus.workInProgress,
    contractStatus.returnShipped,
  ],
  [contractStatus.canceled]: [],
  [contractStatus.completed]: [],
});

/**
 * Asserts that transitioning from `from` to `to` is permitted.
 * Admins can force-transition any non-terminal state to CANCELED.
 * Throws an Error with code contractErrors.INVALID_TRANSITION if disallowed.
 */
export function assertTransition(from, to, isAdmin = false) {
  if (isAdmin && to === contractStatus.canceled) {
    if (from === contractStatus.canceled || from === contractStatus.completed) {
      const err = new Error(`Cannot cancel an already terminal contract from ${from}`);
      err.code = contractErrors.ALREADY_CANCELED;
      throw err;
    }
    return; // Admin force-cancel override for any in-flight status
  }

  const allowed = TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Invalid contract transition from ${from} to ${to}`);
    err.code = contractErrors.INVALID_TRANSITION;
    throw err;
  }
}
