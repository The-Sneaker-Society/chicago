# Plan: Auth Guards + Data Isolation for the GraphQL Layer

Status: **Proposed** — not started. Companion to [AGENTS.md](AGENTS.md) and the service–repository refactor ([#69](https://github.com/The-Sneaker-Society/chicago/pull/69)).

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

Phase PRs, each independently shippable after #69 merges:

| Phase | Scope | Notes |
|---|---|---|
| 1 | `src/auth/guards.js` + context cleanup in `utils/auth/auth.js` | No resolver changes yet. Purely additive. |
| 2 | Migrate `group.js` + `image.resolvers.js` | Delete `requireAuthenticatedMember`; collapse the `_id \|\| dbUser \|\| clerkId` chains now that context guarantees `dbUser`. |
| 3 | **Scoping**: chat domain (`getChatById`, `Chat.messages`, chat lists) + contract reads (`contractById`, `getContractList`, field resolvers) | New scoped repository methods + `<domain>.constants.js` error objects; NOT_FOUND-not-FORBIDDEN doctrine. Member-side mutations get guards here too. |
| 4 | Client-side resolvers (`clients.js`, users queries) + remaining guards | `requireClient`; same scoping treatment for user-facing reads. |
| 5 (deferred) | Directory queries (`Query.users/members/clients`) — remove or admin-gate | Blocked on product decision + admin role existing. |

## Open questions (need product decision)

1. **Should list queries become authenticated?** Decided: yes, but scoping comes first (Phases 3–4) — a guard on an unscoped query just changes who can snoop, not whether the data leaks. Full removal/admin-gating of directory queries is deferred to Phase 5 pending admin-role work.
2. **Role ≠ ownership stays split** — guards answer "are you a member/client"; scoped queries answer "is this row yours"; services keep domain errors for business-rule violations. Confirmed.
3. Does anything call the API without a Clerk session (webhooks, cron)? `src/cron-jobs/` bypasses GraphQL today, but verify before making everything `requireAuth`.

## Acceptance criteria

Part A:
1. Zero per-file auth helpers; all role checks flow through `src/auth/guards.js`.
2. All auth failures return Apollo `ForbiddenError` with consistent `extensions.code`.
3. `utils/auth/auth.js` imports no Mongoose models (uses repositories).

Part B:
4. Every repository read method either takes a requester id and scopes on it, or is explicitly documented as public-safe (e.g., discover projections).
5. Id-based reads surface NOT_FOUND (never FORBIDDEN) for rows the requester doesn't own; codes defined in `<domain>.constants.js`.
6. Traversal chains in the audit table are dead ends: no field resolver exposes another tenant's rows.

Both parts:
7. No change to success-path behavior or resolver names/shapes for legitimate owners.
8. Smoke test: resolver index loads Q:22 M:32; unauthenticated request to a guarded mutation returns FORBIDDEN, not 500.

## Out of scope

- Schema directives (`@auth(requires: ...)`) — requires typeDef changes and custom directive wiring; revisit only if declarative SDL-level control becomes a real need.
- Clerk template/JWT claim changes (role currently lives in `unsafeMetadata` — moving it to publicMetadata/session claims is a separate infra task).
