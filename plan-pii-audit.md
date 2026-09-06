# Follow-up: PII Audit & Field-Level Scoping (post-escrow)

Status: **Done — implemented and verified with unit tests.** Source: ad-hoc security audit 2026-09-06.

## Finding 1 (high): `memberById` exposes full `Member` to any authed user
- `src/resolvers/members.resolver.js:17` is `requireAuth`; `type Member`
  (`src/models/schema/types/member.js:33-64`) includes email, phoneNumber,
  addressLineOne/Two, city/state/zipcode/country, stripeConnectAccountId,
  stripeCustomerId. Any authenticated user with a member ID (harvested from
  discovery pages, chats, contracts) can pull all of it with a single query.
- Constraint: `ContractForm` (client intake) legitimately reads public profile +
  `contractsDisabled` via this query — cannot simply lock to self/admin.
- Proposed fix: null sensitive scalars unless requester is self or admin,
  or split `publicMemberById` and restrict `memberById`.

## Finding 2 (medium): `Contract.member` / `Contract.client` unscoped + full-typed
- `src/resolvers/contracts.js:415-428` (`getContractMember`/`getContractClient`)
  return full records with no party-need check.
- Open product question: neither party strictly needs the other's PII — labels are
  generated server-side and only printed. Decide what the counterparty may see
  (proposal: names + businessName only) vs what stays private.
- Frontend impact: none — UI only reads names/business info/`contractsDisabled`.

## Finding 3 (low): `getServiceMenu` has no guard at all
- `src/resolvers/members.resolver.js` (~line 72): no `requireAuth`. Public business
  data, scraper-level risk. One-word fix: add `requireAuth`.

## Already verified safe (do not regress)
- `getDiscoverMembers` returns `PublicMember` only (deliberate).
- `Member.chats`, `Chat.contract`, `User.chats` requester-scoped.
- `members` / `clients` directories `requireAdmin`.

## Acceptance
- Re-run the audit curl as a non-party user: PII fields return null; public flows
  (intake, contract pages, chat) still render.
