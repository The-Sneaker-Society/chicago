# Plan: Timeline UI & Event Log Expansion (Feature #3 — `features.md:3`)

## Objective
Every lifecycle milestone is recorded as a `contractEvent` and rendered in the member/client Timeline with consistent copy, order, and timestamps. No “where are my shoes?” gap.

## Current State
- `src/contracts/contract.constants.js:32-53` already 19 `contractEvent` values (`contractCreated`…`disputeResolved`) + alias `timelineEvent` — done in Feature #2 PR #76. `Contract.timeline: [{event:String, date:Date}]` already `src/models/Contract.model.js:90`.
- `sneaker-web/src/components/Timeline.jsx:5` has `eventMap` 19 + legacy fallbacks, but `sneaker-web/src/pages/ContractsPage/ContractReviewSummary.jsx:453` and `ContractDetailsPage.jsx:24` duplicate rendering with ad-hoc `STATUS_COLORS` and `entry.event.replace` (recently patched for null).
- `src/contracts/contract.service.js:123/164` and `src/chat/chat.service.js:161` now push correct `priceProposedByMember` etc, but `UNBOXING_PHOTOS_UPLOADED`/`WORK_STARTED` etc are never pushed yet (gated by future PRs). Timeline is under-utilized.

## Design

### Backend (no migration — additive only)

**1. Audit pushes — ensure every status change pushes an event**
- Map status → event (derive from `contractEvent` to avoid drift):
```js
const statusToEvent = {
  [contractStatus.pendingReview]: contractEvent.contractCreated,
  [contractStatus.priceProposed]: contractEvent.priceProposedByMember,
  [contractStatus.awaitingPayment]: contractEvent.paymentCompleted,
  [contractStatus.readyToShip]: contractEvent.inboundLabelGenerated,
  [contractStatus.inboundShipped]: contractEvent.inboundShipped,
  [contractStatus.arrivedAtMember]: contractEvent.inboundDelivered,
  [contractStatus.workInProgress]: contractEvent.workStarted,
  [contractStatus.returnShipped]: contractEvent.returnShipped,
  [contractStatus.deliveredToUser]: contractEvent.returnDelivered,
  [contractStatus.completed]: contractEvent.contractCompleted,
  [contractStatus.canceled]: contractEvent.contractCanceled,
  [contractStatus.underManualReview]: contractEvent.disputeOpened,
};
```
- Update `src/contracts/contract.service.js:transitionTo` (after `plan-contract-transitions` lands) to auto-push; for now manually audit `createContract`, `proposePrice`, `initiateContractChat`, `releasePayout`, and add missing pushes for `unboxingPhotosUploaded`/`workStarted` placeholders (no-ops until those features land).

**2. `src/contracts/contract.repository.js` — optional helper**
- `addTimelineEvent(contractId, event, actor)` — centralizes `$push` + validation `Object.values(contractEvent).includes(event)`.

### Frontend — single source of truth

**3. `sneaker-web/src/utils/timelineConfig.js` (NEW)**
```js
export const TIMELINE_CONFIG = {
  CONTRACT_CREATED: { label: "Contract Created", icon: FiFileText, color: "#F59E0B" },
  PRICE_PROPOSED_BY_MEMBER: { label: "Price Proposed", icon: FiDollarSign, color: "#3B82F6" },
  // ... all 19 + legacy PRICE_PROPOSED, PAYMENT_RECEIVED fallbacks
  UNKNOWN: { label: "Update", icon: FiClock, color: "#6B7280" },
};
export const TIMELINE_ORDER = ["CONTRACT_CREATED","CHAT_INITIATED", ...]; // for sorting if dates equal
```

**4. `sneaker-web/src/components/Timeline.jsx`**
- Import `TIMELINE_CONFIG`, drop local `eventMap`, render via config: `const cfg = TIMELINE_CONFIG[event] ?? TIMELINE_CONFIG.UNKNOWN`, handle `entry.event == null` already patched.
- Sort by `date` asc, sticky date grouping (`format(new Date(Number(date)||date), "MMM d, h:mm a")`).

**5. `sneaker-web/src/pages/ContractsPage/ContractReviewSummary.jsx:453` + `ContractDetailsPage.jsx:24`**
- Remove duplicated `STATUS_COLORS`/`eventMap` rendering, import `STATUS_UI_CONFIG` + `TIMELINE_CONFIG` and reuse `Timeline` component instead of inline map. Delete 60-line duplicate.

## Verification
```bash
node --check src/contracts/contract.constants.js
node --check sneaker-web/src/utils/timelineConfig.js
node --check sneaker-web/src/components/Timeline.jsx
# manual: create contract → propose price → pay → check timeline shows 3 ordered events with correct labels/times, refresh, verify legacy contracts with old events still render via fallback
```

## Out of scope
- New backend events that require shipping/auth (e.g. `UNBOXING_PHOTOS_UPLOADED`) — just the rendering + existing pushes.

## Rollout
Single PR `feature/timeline` off `main` — frontend-heavy, no DB migration, parallel-safe with Service Menu. Own domain `src/components/Timeline`.
