# Plan: Contract Status Transition Machine (+ PRICE_DECLINED, CANCELLED)

Status: **Proposed** — queue behind the merge stack (#61, #69–#74, Wave 2.5 #75). Companion to [plan.md](plan.md) and [AGENTS.md](AGENTS.md). No dependency on those PRs other than merge order (this builds directly on `contract.constants.js` / `contract.service.js` from #63/#69).

## Problem

Contract `status` is written from at least four scattered places (`createContract`, `proposePrice`, the chat proposal shim, `releasePayout`), each hand-rolling its update + timeline event. Worse, `updateContract` merges arbitrary fields **including `status`/`payoutStatus`**, so a contract owner can skip to `PAYOUT_RELEASED` without a payout ever existing. And there is no way to say "no": a client who rejects a price has no action, and there is no way to kill a dead or abusive contract.

## Decisions (product)

1. Only **members** propose prices; clients accept, decline, or counter (member re-proposes).
2. New status **`PRICE_DECLINED`** — non-terminal; member may re-propose from it.
3. New status **`CANCELLED`** — terminal. Members cancel their *own* contracts pre-shipment; **admins can force-cancel any contract at any stage** (moderation: block a bad-actor member, stop the bleeding on pending contracts).

## Design

### 1. Constants (`src/contracts/contract.constants.js`)

Add to `contractStatus`: `priceDeclined: "PRICE_DECLINED"`, `cancelled: "CANCELLED"` — additive only, safe for existing documents (no migration needed; old docs simply never hold these values until a transition writes them).

Add to `timelineEvent`: `proposalDeclined`, `contractCancelled`.

### 2. The machine (`src/contracts/contract.transitions.js`)

```js
import { contractStatus } from "./contract.constants.js";
const S = contractStatus;

export const TRANSITIONS = Object.freeze({
  [S.pendingReview]:   { allowed: [S.priceProposed, S.cancelled] },
  [S.priceProposed]:   { allowed: [S.priceAccepted, S.priceDeclined, S.pendingReview, S.cancelled] },
  [S.priceDeclined]:   { allowed: [S.priceProposed, S.cancelled] },          // member re-proposes
  [S.priceAccepted]:   { allowed: [S.waitingShipment, S.cancelled] },
  [S.waitingShipment]: { allowed: [S.shipped, S.cancelled] },
  [S.shipped]:         { allowed: [S.arrivedAtMember] },                     // physical custody begins
  [S.arrivedAtMember]: { allowed: [S.workInProgress] },
  [S.workInProgress]:  { allowed: [S.processingReturn] },
  [S.processingReturn]:{ allowed: [S.shippedBack] },
  [S.shippedBack]:     { allowed: [S.userReceived] },
  [S.userReceived]:    { allowed: [S.payoutReleased] },
  [S.payoutReleased]:  { allowed: [] },                                      // terminal
  [S.cancelled]:       { allowed: [] },                                      // terminal
});

export function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.allowed.includes(to)) {
    throw new Error(`INVALID_TRANSITION:${from}->${to}`);
  }
}
```

Deliberate asymmetry: once the shoe is physically in flight (`shipped` onward), normal cancellation stops — only the admin force-cancel path bypasses (below). Regressions are impossible by default; if logistics ever needs one (lost shipment), it becomes an explicit edge in this map after a product call, not an accident.

### 3. Single door: `contractService.transitionTo(contractId, toStatus, ctx)` 

The ONLY code path that writes `status`. Steps:
1. Party-scoped load via existing `findByIdForParty`; miss → `CONTRACT_NOT_FOUND`.
2. Permission check per target status (see table below) — role guards live on the resolver; actor-vs-party checks live here.
3. `assertTransition(contract.status, toStatus)` → domain error `INVALID_TRANSITION` (add to `contractErrors`); resolver translates to `UserInputError` with a readable message.
4. Status-specific preconditions:
   - `priceProposed`: requires Stripe checkout creation (reuse `proposePrice` flow)
   - `priceDeclined`: requires an active proposal message in the contract chat → mark it `metadata.status: "declined"` using the existing supersede mechanism
   - `payoutReleased`: requires `payoutStatus === "pending"` + Stripe transfer success (existing `releasePayout` logic moves here unchanged)
   - `cancelled`: see §4
5. Persist + push timeline event derived from `timelineEvent` constants (event name mirrors status; no hand-built objects).

| Transition | Who (role guard) | Actor rule (service) |
|---|---|---|
| → `priceProposed` | `requireMember` | actor is the contract's member |
| → `priceDeclined` | `requireClient` | actor is the contract's client |
| → `priceAccepted` | `requireClient` | actor is the contract's client (Stripe webhook path skips role check but verifies session metadata) |
| shipping-chain advances | system (webhook/cron) or `requireMember` | verified via contract party |
| → `cancelled` | `requireMember` or `requireAdmin` | member: own contract AND pre-shipment; admin: any contract, any stage |
| → `payoutReleased` | `requireMember` | actor is the contract's member |

### 4. Admin force-cancel & bad-actor blocking

- `cancelContract(contractId, reason)` — members: own + `status ∈ {pendingReview, priceProposed, priceDeclined, priceAccepted, waitingShipment}` (pre-shipment "stop the bleeding").
- Admin override: same mutation, but when `ctx.role === "admin"` it bypasses both ownership and the pre-shipment set — any status → `CANCELLED`, timeline event records `reason` and actor.
- Bulk hook (Phase 2 of this plan): `adminService.blockMember(clerkId)` style operation that cancels all of a member's active contracts in a loop through `transitionTo` (never raw updates), so every cancellation lands in timelines. Blocked-member enforcement itself belongs to the auth/admin work, not here — this plan only guarantees contract cleanup is one call away.

### 5. Close the hole

`updateContract`'s nested-merge loop gets an explicit denylist: `status`, `payoutStatus`, `stripeTransferId`, `paidAt` are stripped from incoming `data` before merging. Status changes now exist *only* through `transitionTo`.

## Rollout (single PR, branch `refactor/contract-status-machine`)

1. Constants additions + `contract.transitions.js` + `INVALID_TRANSITION` error code
2. `transitionTo` in service; refactor `proposePrice` / `releasePayout` onto it; unify chat's duplicate proposal path onto the same method (closes the duplication flagged in the #65 review)
3. `updateContract` denylist
4. New mutations: `declineProposal(contractId)` (`requireClient`), `cancelContract(contractId, reason?)` (`requireMember`/`requireAdmin`) — **schema additions required** (typeDefs + resolver wiring; note this changes the Q/M baseline in smoke tests — record the new counts)
5. Optional follow-up: admin block-member bulk cancellation

## Verification

```bash
node --check <touched files>

# resolver baseline WILL change (two new mutations) — update expected counts here first
timeout 90 npx babel-node --presets @babel/preset-env -e "
  const idx = require('./src/resolvers');
  console.log('Q:' + Object.keys(idx.Query).length + ' M:' + Object.keys(idx.Mutation).length);
"

# state-machine unit sanity via babel-node eval: every status reachable except
# regressions past shipped; cancelled/payoutReleased have no exits
```

Manual: walk a contract through happy path; attempt `updateContract(status: "PAYOUT_RELEASED")` → stripped; attempt decline→accept dead proposal → INVALID_TRANSITION.

## Acceptance criteria

1. Zero direct `status:`/`payoutStatus:` writes outside `transitionTo` (grep-enforced).
2. `updateContract` cannot mutate status-family fields.
3. Client can decline a proposal; member can re-propose from `PRICE_DECLINED`; chat proposal cards reflect declined state.
4. Member self-cancels pre-shipment only; admin cancels anything with audit trail (reason + actor in timeline).
5. All transitions recorded as timeline events; invalid jumps rejected with `INVALID_TRANSITION`.

## Out of scope

- Refund/payment-reversal flows on cancellation (Stripe-side cleanup needs its own design once real money flows).
- Notification emails on decline/cancel (email domain exists but integration is separate work).
- Blocking/unblocking members themselves (belongs to the admin/auth roadmap).
