# Goal: Refactor Group Resolvers into Service–Repository Pattern

Parent rules: [../GOAL.md](../GOAL.md)

## Current state

`src/resolvers/group.js` is the cleanest resolver file — auth helpers already extracted (`requireAuthenticatedMember`, `requireGroupAdminAccess`) — but it still imports `GroupsModel` directly and mixes validation, authorization, and queries.

## Files to create

### 1. `src/groups/group.repository.js`

Only file touching Mongoose in this domain. Export `groupRepository` with at least:

- `findByIdPopulated(id)` — the `.populate("members").populate("createdBy").populate("admins")` chain used by every read
- `findPopulated()` / `findByMemberId(userId)`
- `create(data)` / `updateById(id, updates)` (`{ new: true }`, populated) / `deleteById(id)`

Consider a single private `_populated(query)` helper inside the repository to avoid repeating the populate chain.

### 2. `src/groups/group.service.js`

Export `groupService`. Move here:

- `getGroup(id)` (domain error `GROUP_NOT_FOUND`), `getGroups()`, `getGroupsForUser(userId)`
- `createGroup(creatorMemberId, input)` — name validation, creator dedupe/merge into members, default admins
- `updateGroup(requesterMemberId, id, updates)` — admin-access check + creator-must-remain rule
- `deleteGroup(requesterMemberId, id)`

**Authorization:** keep `requireAuthenticatedMember` in the resolver layer (it reads `ctx.role`/`ctx.dbUser` — that's context/auth), but move the group-level access decision ("is requester creator or admin?") into the service as e.g. `assertGroupAdmin(group, memberId)` throwing domain error `FORBIDDEN`. Resolvers translate it to an Apollo-appropriate error.

### 3. Rewrite `src/resolvers/group.js`

Keep exported shape `{ Query, Mutation }` and all resolver names.

## Bugs to fix while refactoring

1. `getGroup` returns null for a missing id instead of a clear error — decide: preserve current null behavior (schema-compatible, safe) and only add domain errors where a mutation already throws. Do not change Query return shapes.
2. No other known bugs; this domain is mostly a mechanical split.

## Acceptance criteria

1. Zero Mongoose model imports in `src/resolvers/group.js`.
2. Zero `apollo-server*` imports in `src/groups/*`.
3. All resolver names and return shapes unchanged.
4. `node --check` passes on all touched files; app boots.
