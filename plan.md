# Plan: Auth Guards + Data Isolation for the GraphQL Layer

Status: **Implemented (draft PRs awaiting review)** — Wave 1: #70 · Wave 2: #71, #72, #73 · Wave 3: #74. Merge order: #69 → #70 → {#71, #72} → #73 → #74. Companion to [AGENTS.md](AGENTS.md) and the service–repository refactor ([#69](https://github.com/The-Sneaker-Society/chicago/pull/69)).

This plan has two parts that ship together but layer cleanly:

- **Part A — Role guards** ("decorators"): who may enter which door.
- **Part B — Service scoping / data isolation**: once inside, what rows even exist for you. *Decided: query-level scoping (flavor 2) is the default pattern; row gates only where a single id-based read demands it.*

## Part B problem: graph traversal exposure

With nothing but an authenticated token, these chains are traversable today:

```
Query.members  →  Member.chats   →  Chat.messages     ← full private conversation transcripts
Query.users    →  User.contracts →  Contract.member   ← jump client → contracted member
Query.members  →  Member.clients →  User.*            ← member → every client they serve
Query.clients  →  Client.contracts → ...              ← same hop, other direction
```

There is no cross-tenant guard anywhere on reads. The one correctly-scoped query, `getDiscoverMembers` (participant-scoped, scored, `$project`ed to a `PublicMember` shape with no PII), is the template.

### Scoping doctrine (decided)

1. **Scope at the query level** — every repository read takes the requester's db id and filters on it (`$or: [{ userId }, { memberId }]`). No code path materializes another tenant's rows.
2. **List queries return `[]`, never an error**, when nothing matches — "zero results" leaks nothing and needs no new error codes.
3. **Id-based reads return NOT_FOUND, never FORBIDDEN** when the scoped `findOne` misses — distinguishing "doesn't exist" from "exists but isn't yours" is an enumeration aid (same reason GitHub 404s private repos).
4. **Error codes live in `<domain>.constants.js`** (`chatErrors.CHAT_NOT_FOUND` etc., frozen objects per the AGENTS.md constants convention); resolvers translate them to Apollo errors exactly as today.
5. **Guards ≠ scoping ≠ projection.** Guards answer role; scoping answers ownership; discover-style `$project` answers field visibility. All three stay separate layers.

### Audit of currently-exposed reads → fix

| Read | Today | Fix |
|---|---|---|
| `Query.users` / `members` / `clients` | Full directory dump incl. PII | Remove or admin-gate (Phase B3; product decision pending) |
| `Chat.messages` field resolver | Any chat's transcript to anyone | Scoped via participant-gated parent chat |
| `Query.getChatById` | Any chat by id | `findChatByIdForParticipant(chatId, requesterDbId)` |
| `User.contracts` field resolver | Contracts by clientId, no requester check | Scope through logged-in user's own id (`ctx.dbUser._id`) instead of trusting `parent.id` chains |
| `Member.chats` / `Member.clients` / `Contract.member/client` | Cross-tenant hops | Each pivot row gated by ownership before its children resolve |
| `Query.contractById`, `getContractList` | Any contract by id | Scoped to `memberId`/`clientId` = requester |
| `getDiscoverMembers` | ✅ Already correct | None — reference implementation |

## Problem (guards)

Every resolver hand-rolls its own auth check, with inconsistent idioms and messages:

| Idiom | Where seen |
|---|---|
| `if (!ctx.dbUser) throw ...` | contracts (`contracts` query), members |
| `requireAuthenticatedMember(ctx)` local helper | group.js (defined per-file!) |
| `const clerkUserId = ctx?.userId \|\| ctx?.auth?.userId; if (!clerkUserId) throw` | image.resolvers |
| `ctx.dbUser?._id?.toString() \|\| ... || clerkUserId` fallback chains | image.resolvers |
| Nothing (public by accident?) | users `users` query, chat `messages`, clients `clients` |

Messages vary: `"Unauthorized"`, `"Unauthorized: Member ID is missing in the context."`, `"Only authenticated members can perform this action."` There is no single place that answers "who is allowed to call this?"

## Constraint check: can we use real `@decorators`?

No, not cleanly. Real decorator syntax requires class fields/methods plus `@babel/plugin-proposal-decorators`. Our resolvers are **object literals** (`{ Query: { users() {} } }`) — decorators don't apply to object-literal methods, and migrating every resolver file to classes would churn all six domains for zero behavioral gain.

So: implement decorators *semantically* as **higher-order resolver wrappers**, which give identical ergonomics:

```js
updateContract: requireMember(async (parent, args, ctx) => { ... })
```

## Design

### New file: `src/auth/guards.js`

```js
import { ForbiddenError } from "apollo-server-core";

export const ROLES = Object.freeze({ MEMBER: "member", CLIENT: "client" });

// Internal factory — do not export publicly.
const guard = (predicate, message) => (resolver) =>
  async (parent, args, ctx, info) => {
    if (!predicate(ctx)) {
      throw new ForbiddenError(message);
    }
    return resolver(parent, args, ctx, info);
  };

/** Any authenticated user (Clerk userId + role resolved in context). */
export const requireAuth = guard(
  (ctx) => Boolean(ctx?.userId && ctx?.role),
  "Unauthorized"
);

/** Authenticated AND role === "member". */
export const requireMember = guard(
  (ctx) => ctx?.role === ROLES.MEMBER && Boolean(ctx?.dbUser),
  "Only authenticated members can perform this action."
);

/** Authenticated AND role === "client". */
export const requireClient = guard(
  (ctx) => ctx?.role === ROLES.CLIENT && Boolean(ctx?.dbUser),
  "Only authenticated clients can perform this action."
);
```

Design decisions baked in above:

1. **`ForbiddenError`, not `Error`/`UserInputError`** — 403-class Apollo error; frontend can branch on `error.extensions.code === "FORBIDDEN"` instead of string-matching messages.
2. **Guards attach no data.** They only admit or reject. Resolvers keep reading `ctx.dbUser` themselves — no hidden second parameter, no surprises when someone reads the resolver body.
3. **Predicate style** keeps `requireAdmin`-style future roles a one-liner.

### Optional sugar: whole-map wrapping

For files where *every* mutation shares one rule, avoid repeating the wrapper per line:

```js
// src/auth/guardMap.js
export const guardMap = (map, wrapper) =>
  Object.fromEntries(
    Object.entries(map).map(([name, resolver]) => [name, wrapper(resolver)])
  );

// usage
const Mutation = guardMap({ createGroup, updateGroup, deleteGroup }, requireMember);
```

Use sparingly — explicit per-resolver wrapping is more greppable. Recommend: per-resolver wrapping as the default, `guardMap` only when a file is uniformly guarded.

### Context cleanup (prerequisite, small)

`src/utils/auth/auth.js::clearkAuthorizeUser` still imports `MemberModel`/`UserModel` directly and logs-and-continues when `dbUser` is missing. As part of this work:

- Route lookups through `memberRepository.findByClerkId` / `userRepository.findByClerkId` (layer rules).
- Decide explicitly: if role exists but db row is missing, either fail fast in context (guards then only check role) or keep returning null and let guards catch it. Recommend **fail fast** — every guard currently assumes `dbUser` may be null, which is the root cause of the fallback-chain noise in image.resolvers.

## Rollout

Execution is grouped into **three waves**: a single foundation PR (Phases 0+1 land together — they modify the same context code and neither is independently testable), then parallel per-domain PRs branched off it, then directory lockdown.

### Wave 1 — Auth foundation (ONE agent, ONE worktree, ONE PR)

| Phase | Scope | Notes |
|---|---|---|
| 0 | **Role metadata migration** (decided: Clerk `unsafeMetadata` → `publicMetadata`) — see "Admin role & metadata migration" below; includes backfill script / user-recreation path | Must land with Phase 1; guards read the role from context |
| 1 | `src/auth/guards.js` + rewrite of the context builder in `utils/auth/auth.js` (`publicMetadata.role`, admin recognition, `dbUser` fail-fast, repository-based lookups) | No resolver changes yet. Purely additive. |

**Why not parallel:** both phases rewrite `utils/auth/auth.js` (role source vs context guarantees) — guaranteed conflict in the code everything downstream depends on, and neither branch is testable alone.

### Wave 2 — Per-domain migrations (PARALLEL agents, one worktree each)

Branched off Wave 1 after it merges. Disjoint resolver files, so worktrees don't stomp each other:

| PR | Agent | Files | Scope |
|---|---|---|---|
| 2 | A | `src/resolvers/group.js`, `src/photo-upload-service/image.resolvers.js` | Delete `requireAuthenticatedMember`; collapse `_id \|\| dbUser \|\| clerkId` chains now that context guarantees `dbUser`. |
| 3 | B | `src/resolvers/contracts.js`, `src/resolvers/members.resolver.js`, `src/resolvers/chat/chat.js` + their `src/<domain>/` layers | Member-side guards + **scoping**: chat domain (`getChatById`, `Chat.messages`, chat lists), contract reads (`contractById`, `getContractList`, field resolvers). Scoped repository methods + `<domain>.constants.js` error objects; NOT_FOUND-not-FORBIDDEN doctrine. |
| 4 | C | `src/resolvers/clients.js`, `src/resolvers/users.js` + their domains | `requireClient` + same scoping treatment for user-facing reads. |

Suggested scheduling: **PRs 2 and 3 simultaneously**, then **PR 4** (its review should see B's finished scoping patterns — the users-side reads sit on the traversal chain B closes).

### Wave 2.5 — Group-post resolvers (blocked on #61)

#61 (group page data rules) lands `joinGroup`/`leaveGroup`, posts, and comments with per-file auth helpers and review-agreed `TODO` markers for centralized guards. A placeholder draft PR tracks the follow-up: **[#75](https://github.com/The-Sneaker-Society/chicago/pull/75)** (`refactor/group-post-guards`, plan in its `plan-group-posts.md`). Execute only after #61 and Waves 1–3 merge.

### Wave 3 — Directory lockdown (single small PR)

| PR | Scope | Notes |
|---|---|---|
| 5 | Directory queries → `requireAdmin`: `Query.users`, `Query.members`, `Query.clients`; decide delete-vs-admin for `Query.messages` (likely delete once chats are participant-scoped) | Prereq: users recreated/backfilled with `publicMetadata.role`. Uses admin role from Wave 1. |

## Admin role & metadata migration (DECIDED — Option B)

Not live yet, so we migrate cleanly instead of carrying compatibility shims. Wipe DBs / recreate users is acceptable.

1. **Move the role out of `unsafeMetadata` into `publicMetadata`** on every Clerk user (`publicMetadata.role = "member" | "client" | "admin"`). `publicMetadata` is readable by the backend via `clerkClient.users.getUser()` but cannot be written by client SDKs — only server/admin API calls can set it. This closes the self-promotion hole where a user could edit their own unsafe metadata.
2. **Audit every writer of roles** — anywhere the frontend or scripts currently set `unsafeMetadata.role` at signup must switch to the new mechanism (frontend should set NO role metadata at all; role assignment becomes a backend/admin concern, e.g. default `"client"` applied server-side at signup webhook or explicit admin action).
3. **Update the reader** in `utils/auth/auth.js`: `clerkUser.publicMetadata?.role`.
4. **Teach context about `admin`**: admins are staff accounts with no Member/User row, so the context builder must not treat missing `dbUser` as an error when `role === "admin"` — it resolves `{ userId, role: "admin", dbUser: null }`. Guards like `requireMember`/`requireClient` correctly reject admins; `requireAdmin` accepts them.
5. **One-time backfill script** (or user recreation): iterate Clerk users, copy `unsafeMetadata.role` → `publicMetadata.role`, clear the unsafe value. Since DBs will be wiped, recreating test users with correct publicMetadata is equally fine.

## Open questions (need product decision)

1. ~~Should list queries become authenticated?~~ **Decided:** yes — directory queries get `requireAdmin` in Wave 3; everything else gets role guards + query-level scoping in Wave 2.
2. ~~Standardize error copy?~~ **Decided:** role guards ≠ ownership checks. Guards answer "are you a member/client"; scoped queries answer "is this row yours"; services keep domain errors for business-rule violations.
3. Does anything call the API without a Clerk session (webhooks, cron)? `src/cron-jobs/` bypasses GraphQL today, but verify before making everything `requireAuth`.

## Acceptance criteria

Guards:
1. Zero per-file auth helpers; all role checks flow through `src/auth/guards.js`.
2. All auth failures return Apollo `ForbiddenError` with consistent `extensions.code`.
3. No code path reads role from `unsafeMetadata`; no client-side writer of role metadata remains.

Scoping:
4. Every repository read method either takes a requester id and scopes on it, or is explicitly documented as public-safe (e.g., discover projections).
5. Id-based reads surface NOT_FOUND (never FORBIDDEN) for rows the requester doesn't own; codes defined in `<domain>.constants.js`.
6. Traversal chains in the audit table are dead ends: no field resolver exposes another tenant's rows.

Both:
7. No change to success-path behavior or resolver names/shapes for legitimate owners.
8. `utils/auth/auth.js` imports no Mongoose models (uses repositories).
9. Smoke test: resolver index loads Q:22 M:32; unauthenticated request to a guarded mutation returns FORBIDDEN, not 500; directory queries reject non-admin roles with FORBIDDEN.

## Out of scope

- Schema directives (`@auth(requires: ...)`) — requires typeDef changes and custom directive wiring; revisit only if declarative SDL-level control becomes a real need.
- Session-claim/JWT template customization (role arrives via a `getUser` fetch per request today; embedding it in the JWT would remove that round-trip but is optional infra polish).
