# Plan: Resolver Auth Guards ("decorators") for Member / Client Roles

Status: **Proposed** — not started. Companion to [AGENTS.md](AGENTS.md) and the service–repository refactor ([#69](https://github.com/The-Sneaker-Society/chicago/pull/69)).

## Problem

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
| 3 | Migrate `contracts.js`, `members.resolver.js`, `chat/chat.js` member-side mutations | Also closes accidental-public queries if desired — see open questions. |
| 4 | Migrate client-side resolvers (`clients.js`, users queries) | Same pattern with `requireClient`. |

## Open questions (need product decision)

1. **Should list queries become authenticated?** `Query.users`, `Query.messages`, `Query.clients` currently return entire collections to anyone. Guarding them changes frontend behavior — confirm the frontend never calls these anonymously before adding `requireAuth`.
2. **Standardize error copy?** Wrappers centralize messages, so e.g. contracts' `"Unauthorized: Contract does not belong to this member"` (ownership, not role) stays separate — role guards ≠ ownership checks. Ownership checks stay in services as domain errors (`UNAUTHORIZED`); only *role* auth moves into guards. Don't conflate the two.
3. Does anything call the API without a Clerk session (webhooks, cron)? `src/cron-jobs/` bypasses GraphQL today, but verify before making everything `requireAuth`.

## Acceptance criteria

1. Zero per-file auth helpers; all role checks flow through `src/auth/guards.js`.
2. All auth failures return Apollo `ForbiddenError` with consistent `extensions.code`.
3. No change to success-path behavior or resolver names/shapes.
4. `utils/auth/auth.js` imports no Mongoose models (uses repositories).
5. Smoke test: resolver index loads Q:22 M:32; unauthenticated request to a guarded mutation returns FORBIDDEN, not 500.

## Out of scope

- Schema directives (`@auth(requires: ...)`) — requires typeDef changes and custom directive wiring; revisit only if declarative SDL-level control becomes a real need.
- Clerk template/JWT claim changes (role currently lives in `unsafeMetadata` — moving it to publicMetadata/session claims is a separate infra task).
