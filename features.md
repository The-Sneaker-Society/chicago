# Product Roadmap & Features List

> **Last Updated:** 2026-09-02 — `main@d3b077d` / `3f2a345` (chicago / sneaker-web) — P0 + Service Menu merged. See PRs below.

This document translates the Smart Contract Lifecycle into actionable technical features. It is divided into the MVP (Minimum Viable Product) required to launch, and Post-MVP features for scaling.

**Status Key:** ✅ Done (merged to `main`) · 🚧 In Progress / Partial · ⬜ Todo · 🔒 Blocked (needs external setup)

| # | Feature | Status | PR / Plan |
|---|---------|--------|-----------|
| 1 | Service Menu & Graceful Fallback | ✅ Done | chicago #78 + web #175 (`feature/service-menu` → `main@d3b077d`/`3f2a345`) — `Member.serviceMenu[12]` + `MemberServicesPage` full page + intake 2-col cards + Custom header |
| 2 | Contract Schema & State Machine | ✅ Done | chicago #76 + web #173 (`feature/contract-schema` → `main@ca9bfc0`/`8fded25`) — 12-status + 19 `contractEvent` + `statusToKey` + shipping fields |
| 3 | Timeline UI & Event Log Expansion | ✅ Done (core) · 🚧 polish | Core `statusConfig` + `Timeline` eventMap 19 done in #76; full `timelineConfig` + `Transition` wiring tracked in `plan-timeline.md` |
| 4a | EasyPost / Shippo Labels + Webhooks + Return Insurance | 🔒 Blocked · ⬜ Todo | `plan-shipping.md` — needs `EASYPOST_API_KEY` in `config.env`, own PR `feature/shipping` |
| 4b | Review & Protect Checkout Hub | ⬜ Todo | `features.md:4` (duplicate #4) + `plan-contract-lifecycle.md:4` — depends on 4a |
| 5 | Escrow & Dispute (Unboxing, Flag, 72h Auto-Payout) | ⬜ Todo | `plan-custody-auth.md:§3/§5` + `plan-contract-transitions.md` — auto `ARRIVED_AT_MEMBER` via webhook, `UNDER_MANUAL_REVIEW` freeze |
| 6 | Restorer Onboarding & Dashboard Traffic Light | ⬜ Todo | `features.md:6` — `payouts_enabled` sync done, Red/Yellow/Green indicator todo |
| 7 | Billing, Receipts & Payout Dashboards | ⬜ Todo | `features.md:7` + `plan-shipping.md: #4b` follow-up — `line_items` for Service+Shipping+Insurance |
| 8 | Notification System (Email + In-App) | ⬜ Todo | `features.md:8` — SendGrid/Resend + badges |
| 9 | Platform Fee Refactor $12 → 15% | ✅ Done | chicago #77 + web #174 (`feature/platform-fee` → `main@1ada125`/`94ba91d`) — `platformFee 15%` + `PricePreviewModal`, tests |
| 10 | Contract Cancellation Flow | ⬜ Todo | `plan-contract-transitions.md` — `PRICE_DECLINED`/`CANCELED`, `transitionTo` denylist |
| 11 | Admin Dashboard (Manual Review) | ⬜ Todo | `features.md:11` — `UNDER_MANUAL_REVIEW` queue + evidence viewer |
| P2-1 | Digital Authentication (CheckCheck) | ⬜ Todo | `features.md: P2-1` |
| P2-2 | Priority Rush Turnaround | ⬜ Todo | `features.md: P2-2` |
| P2-3 | Aftercare E-Commerce Upsell | ⬜ Todo | `features.md: P2-3` |

## Phase 1: The Core Loop (MVP)

### 1. Restorer "Service Menu" (Standard Pricing) & Graceful Fallback — ✅ Done
*   **Feature:** Allow Members to create a personalized menu of services (e.g., "Basic Clean - $40", "Deep Clean - $75", "Sole Swap - $150") in their profile settings.
*   **Intake Integration (Scenario A):** If the Member has built a menu, the User selects from these options. A "Custom Request" option is always appended to the bottom for unique jobs.
*   **Graceful Fallback (Scenario B):** If the Member has NOT set up a menu, the UI seamlessly defaults to the classic open-ended intake form ("What do you need done?").
*   **Custom Override:** Regardless of the intake method, the Member always has the final say during the `PRICE_PROPOSED` chat phase to adjust or lock in the exact price based on the unboxing/photos.
*   **Done:** `chicago#78` `Member.serviceMenu[12]` (`member.constants`, `Member.model`, `member.service`, `Contract.selectedServiceMenuItem` snapshot, `getServiceMenu`/`upsertServiceMenu` Q:23 M:33) + `sneaker-web#175` `MemberServicesPage` full page `/member/services` + `ContractForm` 2-col cards + `Custom Request` header (Avatar + `plus taxes and shipping` pill `1.35rem` #FFD100).

### 2. Contract Schema & State Machine Updates — ✅ Done
*   **Feature:** Update the MongoDB `Contract` schema to support the new lifecycle.
*   **New Fields:** `declaredValue`, `shippingPreset` (1 pair vs multi), `insuranceFee`, `shippingSpeed`.
*   **New Statuses:** Map the enums for the 9-stage flow (`INBOUND_SHIPPED`, `ARRIVED_AT_MEMBER`, `UNDER_MANUAL_REVIEW`, `WORK_IN_PROGRESS`, `RETURN_SHIPPED`, `DELIVERED_TO_USER`).
*   **Done:** `chicago#76` `contract.constants` 12-status + 19 `contractEvent` + `statusToKey`, `Contract.model` shipping fields, `contract.service` `STAGE_MAP`, `sneaker-web#173` `STATUS_UI_CONFIG`.

### 3. Timeline UI & Event Log Expansion — ✅ Done (core) / 🚧 polish
*   **Backend Event Tracking:** Update the `ContractEvents` constants/schema to record every new lifecycle milestone (e.g., `PRICE_PROPOSED_BY_MEMBER`, `SHIPPING_UPSELLS_SELECTED`, `UNBOXING_PHOTOS_UPLOADED`).
*   **Frontend Timeline UI:** Refactor the visual Timeline component on the client/restorer dashboards to map to these new granular events, ensuring users know exactly where their shoes are in the 9-stage journey.
*   **Done core:** Event constants + `Timeline.jsx` 19 + legacy fallbacks done in #76. **Remaining polish** tracked in `plan-timeline.md` — `timelineConfig` dedupe + `statusToEvent` wiring for `UNBOXING_PHOTOS_UPLOADED` etc.

### 4a. EasyPost / Shippo API Integration — 🔒 Blocked
*   **Label Generation:** Backend logic to automatically purchase and generate Inbound and Outbound PDF labels using the standard weight presets (e.g., 4 lbs vs 8 lbs).
*   **Webhook Listeners:** Listen for carrier scan events to automatically update contract statuses (e.g., "In Transit", "Delivered") without manual input.
*   **Dynamic Return Insurance (Shrinkage Protection):** When generating the *Outbound (Return)* label, dynamically increase the insured value to equal `(Declared Value + Service Price)`. This ensures if the carrier loses the package on the return trip, the insurance claim covers both the cost of the shoes for the User AND the payout for the Member, saving the platform from eating the loss.
*   **Plan:** `plan-shipping.md` — own PR `feature/shipping`, blocked until `EASYPOST_API_KEY` + webhook secret in `config.env`.

### 4b. The "Review & Protect" Checkout Hub — ⬜ Todo
*   **Feature:** Build the intermediary UI screen before Stripe.
*   **Dynamic Math:** Calculate shipping costs based on the speed selected (Standard vs. Expedited) and calculate the insurance premium (e.g., 2% of the `declaredValue`).
*   **Stripe Integration:** Pass the final grouped total to the Stripe Checkout Session.

### 5. Escrow & Dispute Logic (The Fraud Circuit Breaker) — ⬜ Todo
*   **Unboxing Checkpoint:** UI requirement for the Member to upload unboxing photos before the "Start Work" button unlocks.
*   **Flag Package:** A button for the Member to dispute the arrival condition. Automatically changes status to `UNDER_MANUAL_REVIEW` and freezes the Stripe funds.
*   **72-Hour Auto-Payout:** A cron job that runs every hour, checks for contracts in `DELIVERED_TO_USER` that are older than 72 hours, and triggers the Stripe Connect payout.

### 6. Restorer Onboarding & Dashboard UI — ⬜ Todo
*   **Stripe Status Sync:** Listen to Stripe `account.updated` webhooks (or fetch dynamically) to monitor the Member's `payouts_enabled` and `requirements.currently_due` status.
*   **At-a-Glance "Traffic Light" Indicator:** Add a surface-level visual indicator (e.g., Red = Action Required, Yellow = Pending Stripe Verification, Green = Payouts Enabled) on the main dashboard so Members know their onboarding status immediately without extra clicks.

### 7. Billing, Receipts & Member Payout Dashboards — ⬜ Todo
*   **User Itemized Checkout & Receipts:** Update the `createPaymentIntent` function to accept an array of `line_items` (Service, Shipping, Insurance) instead of a single integer. This allows Stripe to automatically display an itemized breakdown at checkout and email an itemized PDF receipt to the User.
*   **Member In-App Breakdown:** On the Member's contract details page, display a clean breakdown of the finalized math (e.g., `Service Price: $200 | Platform Fee: -$30 | Net Earning: $170`) for transparency.
*   **Stripe Express Dashboard Link:** Implement an API endpoint using `stripe.accounts.createLoginLink` to allow Members to log into their secure Stripe Express Dashboard. This provides them with official bank deposit statements, earnings tracking, and end-of-year tax forms (1099s) automatically generated by Stripe.

### 8. Notification System (Email + In-App Alerts) — ⬜ Todo
*   **Transactional Emails:** Integrate a service (SendGrid, Resend, or AWS SES) to send automated emails at key lifecycle milestones:
    *   Member receives: "New Contract Submitted," "Payment Received — Print Label," "Dispute Filed."
    *   User receives: "Price Proposed," "Shoes Shipped (with tracking link)," "Shoes Delivered — 72hr Review Started," "Payout Released."
*   **In-App Dashboard Alerts:** Display unread notification badges/banners on both User and Member dashboards for actions that require their attention (e.g., "1 contract awaiting your review").

### 9. Platform Fee Refactor (Flat $12 → Dynamic 15%) — ✅ Done
*   **Feature:** Remove the hardcoded `PLATFORM_FEE_CENTS = 1200` constant from `stripe.service.js` and replace it with a percentage-based calculation (e.g., 15% of the proposed service price).
*   **Why:** A flat $12 fee causes the platform to lose money on high-ticket contracts (e.g., a $500 sole swap where Stripe takes ~$14.80 in processing fees). A percentage fee ensures the platform is always profitable regardless of the contract value.
*   **Implementation:** Calculate `platformFeeCents = Math.round(servicePrice * 0.15 * 100)` dynamically in the `createPaymentIntent` function and store it in contract metadata.
*   **Done:** `chicago#77` `platformFee` 15% in `stripe.service`, `contract.service` `payoutAmount`, `sneaker-web#174` `PricePreviewModal` + `ContractDetailsPage`, tests 16.

### 10. Contract Cancellation Flow — ⬜ Todo
*   **Feature:** Define the rules and backend logic for contract cancellation at each stage of the lifecycle.
*   **Before Payment (`PENDING_REVIEW`, `PRICE_PROPOSED`):** Either party can cancel freely. No money has changed hands. Status → `CANCELED`.
*   **After Payment, Before Shipping (`READY_TO_SHIP`):** User can cancel but forfeits the cost of any already-purchased shipping labels. Remaining balance is refunded via Stripe.
*   **After Shipping (`INBOUND_SHIPPED` and beyond):** Cancellation is no longer available. The contract must proceed to completion or be escalated to `UNDER_MANUAL_REVIEW` for admin intervention.
*   **Plan:** `plan-contract-transitions.md` — `PRICE_DECLINED`/`CANCELED`, `transitionTo`, `updateContract` denylist.

### 11. Admin Dashboard (Manual Review & Dispute Resolution) — ⬜ Todo
*   **Feature:** Build an internal, admin-only web panel for the founding team to manage disputes and platform operations.
*   **Dispute Queue:** View all contracts in `UNDER_MANUAL_REVIEW` status, sorted by severity and age.
*   **Evidence Viewer:** For each disputed contract, display the User's intake photos, the Member's unboxing photos, the full chat transcript, and the EasyPost carrier scan weights (drop-off vs. delivery) side-by-side.
*   **Resolution Actions:** Admin can click "Rule for User" (refund + ban Member), "Rule for Member" (release payout + ban User), or "Inconclusive" (refund both from the Shrinkage budget + ban both accounts).

---

## Phase 2: Upsell Expansion (Post-MVP)

### 1. Digital Authentication (Legit Checking) — ⬜ Todo
*   **Feature:** Integrate CheckCheck or Legitmark API.
*   **UX:** Add the $15 upsell toggle at the "Review & Protect" screen. Add the `AUTHENTICATING` holding status during the Unboxing phase while waiting for the API webhook result.

### 2. Priority Rush Turnaround — ⬜ Todo
*   **Feature:** Add a toggle in the Member's "Propose Price" chat UI to offer a $50 Rush fee.
*   **Logic:** Ensure the platform's 15% fee calculates correctly against the combined total of the service + rush fee.

### 3. Aftercare E-Commerce Upsell — ⬜ Todo
*   **Feature:** A 1-click purchase button on the "Contract Completed" screen offering physical products (Stain Repellent, Brushes).
*   **Logic:** Leverages saved Stripe credentials to immediately bill the User and routes the fulfillment order to Platform HQ for dropshipping.
