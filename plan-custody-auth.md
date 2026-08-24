# Plan: Custody & Authentication — the Shoe Contract Lifecycle

Status: **Proposed**. Depends on [plan-contract-transitions.md](plan-contract-transitions.md) landing first (every automated custody action flows through `transitionTo`). Companion to the Stripe ledger/reconciliation discussions captured there.

Objective: answer, end-to-end, *"someone wants a $100 clean on a $1,000 pair of sneakers — how does the app move the shoes, verify them, and make sure both people come out whole?"*

## Decisions already made (from product discussions)

| Decision | Choice |
|---|---|
| Who proposes prices | Members only; clients accept, decline (→ `PRICE_DECLINED`), or counter |
| Who pays for legit checks | **Client** (Option A) — declaring value means proving it; members never pay |
| Certificate trust | Never screenshots — certificate ID/QR verified live via provider API |
| Skip authentication | Allowed above threshold only with explicit consent + automatic friction penalties ("skip with teeth") |
| Photo chain doctrine | Whoever skips their documentation burden loses authenticity disputes by default |
| Delivery semantics | Carrier delivery scan = truth for custody milestones (industry standard) |

## The happy path (what the app does automatically)

```
 1. CREATE      client creates contract (declaredMarketValue, shoeDetails,
                condition photos uploaded)
 2. AUTH GATE   if declaredMarketValue ≥ threshold → see §1 below
 3. PROPOSE     member proposes price → PRICE_PROPOSED (Stripe checkout created)
 4. PAY         client pays → webhook: PRICE_ACCEPTED, funds on platform balance,
                payoutAmount = price − platformFee stored
 5. SHIP IN     client ships → posts inboundTracking number
                carrier DELIVERED webhook → auto-transition: arrivedAtMember
                (+ member unboxing photos due within 48h)
 6. WORK        workInProgress (timeline photos expected)
 7. SHIP BACK   member completes → pre-return photos → tags item (§3) →
                outboundTracking posted → shippedBack
                label carries signature if required (§2 matrix)
 8. DELIVERED   carrier DELIVERED webhook starts client window (72h default;
                7 days if auth was skipped — §1.4)
 9. RELEASE     window closes clean → userReceived (auto-confirmed) →
                payoutReleased → transfer lands in member's Connect account
```

Every arrow is a `transitionTo` call; every automated one records a timeline event with `actor: "system"` or `"system:auto-confirm"` so human vs machine actions are forever distinguishable in the audit trail.

## §1 The authentication gate

Triggered at step 2 when `declaredMarketValue ≥ AUTH_THRESHOLD` (constant, start ~$1,000–1,500). Three sanctioned paths + one risk path:

| Path | Flow | Cost bearer |
|---|---|---|
| **A. Platform check** (upsell) | Fee added to checkout; platform procures via **CheckCheck Business API** or **Entrupy API**; verdict webhook lands on contract | Client |
| **B. Bring-your-own cert** | Client submits certificate ID/QR → backend verifies LIVE via provider API (`verdict=authentic` AND brand/model match `shoeDetails`) → reference stored. Screenshot-only = rejected by definition | Client (nominal handling fee or free) |
| **C. Decline** | First-class option, equal prominence: *"We can't accept this contract at this declared value — this protects you and your member."* No harm, walk away | — |
| **D. Skip** ⚠️ | Explicit acknowledgment stored on timeline. Consequences applied automatically (not optional): signature mandatory both legs · insured labels mandatory · release hold stretches 72h → 7 days · all authenticity disputes default against client (no proof of what was sent) | Client accepts risk |

Gate behavior: while unresolved, the contract cannot advance past `pendingReview` — no proposal, no checkout. All four choices recorded as timeline events (`AUTH_PROVIDED`, `AUTH_BYO_VERIFIED`, `DECLINED_AT_THRESHOLD`, `AUTH_SKIPPED_RISK_ACCEPTED`).

**Provider notes:** CheckCheck Business exposes API/SDK/webhooks (dual-expert review, sneaker coverage); Entrupy offers REST v2 + SDK + webhooks plus *fingerprinting* (registers a micro-fingerprint at intake that can later verify the returned item is the same physical object — the strongest anti-swap evidence available, reserved for the top value tier).

## §2 Shipping controls matrix

Applied at label-creation time based on `declaredMarketValue`:

| Declared value | Outbound leg (return to client) | Inbound leg |
|---|---|---|
| < threshold | Standard tracked | Standard tracked |
| ≥ threshold | Signature required + insured to declared value | Insured recommended |
| ≥ threshold AND auth skipped | Signature required + insured mandatory (see §1-D) | Insured mandatory |
| Any value, flagged ratio* | Signature + insurance forced | Insurance forced |

\* Flagged ratio = `declaredMarketValue / price > 10` — a $1,000 pair into a $100 cleaning is exactly the profile worth watching regardless of absolute value.

Insurance rides the labels via EasyPost/Shippo declared-value coverage (~$1 per $100) — theft claims pay insurance, not just police reports.

## §3 The photo chain + tags (custody evidence)

Checkpoint photos tied to transitions (enforced via transition preconditions, not honor system):

| Transition | Required upload | Owner | Window |
|---|---|---|---|
| create → pendingReview | Condition photos | Client | before submit |
| → arrivedAtMember | Unboxing photos | Member | 48h after delivery scan |
| → shippedBack | Pre-return photos | Member | before label valid |
| → userReceived (manual path) | Receipt photos incl. **tag serial** | Client | during claim window |

Doctrine: a party who misses their checkpoint forfeits authenticity disputes involving that handoff. No member unboxing photos? Package accepted as-is. No client receipt photos? Tracking-and-tag decide.

### Tags (serialized tamper-evident seals)

StockX's green-tag model, adapted:

- On member onboarding, mail ~10 serialized tamper-evident QR seals (KYC address on file; ~$0.10–0.50/unit)
- New collection: `tags { serial, status: WITH_MEMBER|APPLIED|CONFIRMED|CONSUMED, memberId, contractId }`
- **Serial↔contract binding happens in-app BEFORE the outbound tracking number can be created** — kills tag reuse/stockpiling
- Client's receipt photo must show the intact tag; serial entry confirms it
- Removal destroys the seal — a returned pair with a missing/destroyed seal is itself evidence
- Staging: optional + incentivized at launch (e.g., discounted platform fee on tagged contracts), mandatory above threshold once proven
- Limits stated honestly: tags prove *custody path*, not contents — contents are the legit-check layer's job

## §4 Automation (tracking ingestion)

- Aggregator (EasyPost/Shippo/AfterShip) delivery **webhooks** drive speed; nightly cron over stuck contracts drives completeness (existing `cron-jobs/` pattern)
- `inbound DELIVERED` → `transitionTo(arrivedAtMember, actor: system)` — member laziness stops blocking pipelines
- `outbound DELIVERED` → start client window → clean close auto-confirms `userReceived` → release per §6
- All through `transitionTo`; statuses never written directly by crons/webhooks

## §5 Dispute pause

Either party can raise a dispute flag during any post-payment stage:

- Modeled as a **flag freezing transitions**, not a new status — money stays unreleased, timers stop, both parties notified
- Response deadline (e.g., 72h); non-response = forfeit per photo-chain rules
- Platform adjudicates from checkpoint photos + tag state + cert references — the evidence chain exists precisely so this is reading, not guessing
- Raising a false dispute in bad faith is itself trackable (repeat offenders surface in admin tooling later)

## §6 Money movement recap

Unchanged from `plan-contract-transitions.md`: capture-at-checkout → platform balance holds → single transfer at release → idempotency key per contract → nightly reconciliation of pending-payout sum vs platform balance → refund path on cancellation. Auto-release composes safely because even a double-fired cron hits the idempotent transfer.

## Scenario playbook (the "what if" table)

| Scenario | Outcome |
|---|---|
| Member ghosts after receiving shoes | No outbound scan → no release ever. Client claims → cancel + full refund (money still on platform). Member banned; KYC identity on file |
| Client never confirms receipt but tracking shows delivered | 72h timer auto-confirms → member paid. Mirror-image bad actor solved |
| Client skips auth, receives fakes back, blames member | Member's pre-return photos + tag serial vs nothing from client → client loses by default (agreed at skip time) |
| Client sent fakes, member flags on arrival | Member's unboxing photos vs client's condition photos + cert mismatch → client forfeits; contract cancelled, client refunded minus handling |
| Porch pirate on return leg | Carrier says delivered → tracking-is-truth → member paid; client's recourse is the insured label claim (that's why insurance was mandatory) |
| Member swaps real shoes for fakes mid-work | Tag destroyed/mismatched on return + optional Entrupy fingerprint check on top-tier → objective evidence; KYC'd member, federal mail-fraud exposure |
| Both parties honest, everything normal | Zero manual steps after payment: two webhook-driven transitions and one timed release |

## Implementation order (single epic, phased PRs after transitions land)

1. **PR A — Auth gate**: constants (`AUTH_THRESHOLD` etc.), provider integration (start CheckCheck — lightest), gate precondition on `pendingReview`, three paths + skip-with-teeth, timeline events
2. **PR B — Photo checkpoints**: upload requirements as transition preconditions; storage via existing image-upload-service
3. **PR C — Tracking automation**: aggregator integration, delivery webhooks endpoint, nightly cron, system-actor transitions
4. **PR D — Tags**: collection + lifecycle endpoints, binding enforcement on label creation, serial confirmation flow
5. **PR E — Disputes**: freeze flag, deadlines, admin adjudication view

## Open questions (product)

1. Exact `AUTH_THRESHOLD` and whether it's absolute dollars or ratio-based (or both)?
2. Tag program economics: free to members, cost-recovery, or incentive-discount model?
3. Which provider for launch — CheckCheck (lighter) vs Entrupy (fingerprinting) — and at what value does Entrupy tier kick in?
4. Claim window length: 72h default, 7d for skipped-auth — comfortable?
5. Does the client-facing UI show "⚠️ Unverified high-value contract" badges to *members* too (members deserve to know they're working on an undocumented $1k pair)?

## Acceptance criteria

1. No contract crosses a custody boundary without its checkpoint evidence (or the skip-consent record).
2. Every automated transition traces to a carrier event or expiry, visible in timeline with system actor.
3. Certificates are verified server-side against provider APIs — screenshot submission is impossible.
4. Tag serials are bound to contracts before transit; receipt confirmation requires them.
5. Money never releases except through the gated `userReceived → payoutReleased` edge.
6. Every scenario in the playbook resolves without manual DB edits.

## Out of scope

- Refund reversals/dispute chargeback flows (Stripe-side, separate design).
- Background checks / member vetting beyond Stripe KYC.
- In-house authentication expertise (providers cover this).
