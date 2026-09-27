# Plan: Guards + Scoping for Group-Post/Comment Resolvers (Wave 2.5)

Status: **Planned — execute only after #61 (group page data rules) AND the auth stack (#69 → #70 → #71/#72 → #73 → #74) have merged.** This branch exists as a placeholder/draft PR so the work is tracked; rebase it onto post-merge main before implementing.

Companion to [plan.md](plan.md) (auth guards + data isolation). This is "Wave 2.5": #61 lands group-post features with per-file auth helpers and `TODO` markers left in review; this PR replaces them with the standard guard/scoping layers.

## Scope

#61's new resolvers, none of which are covered by Waves 1–3:

| File | Resolvers | Current state (post-#61) |
|---|---|---|
| `src/resolvers/group.js` | `joinGroup`, `leaveGroup`, `addGroupAdmin`, `removeGroupAdmin`, `removeGroupMember` | Use `getAuthenticatedMemberId(ctx)` helper + ad-hoc checks |
| `src/resolvers/groupPost.js` | Query `getPostsByGroup`; mutations `createPost`, `updatePost`, `deletePost`, `likePost` | Same; gedelao's review added a membership check on `getPostsByGroup` |
| `src/resolvers/comment.js` | Query `commentsPage`; mutations `addComment`, `updateComment`, `deleteComment` | Authorization moved into group-post service during review |
| `src/utils/groupPermissions.js` | `getAuthenticatedMemberId`, `isGroupCreator`, `isGroupAdmin`, `isGroupMember` | Split into three helpers per review |

## Changes

### 1. Replace per-file auth helpers with guards

- Delete every `getAuthenticatedMemberId(ctx)` call site — context now guarantees `ctx.dbUser._id` for member/client roles.
- Guard wiring:
  - **`requireMember`**: `joinGroup`, `leaveGroup`, `createPost`, `updatePost`, `deletePost`, `likePost`, `addComment`, `updateComment`, `deleteComment`, `addGroupAdmin`, `removeGroupAdmin`, `removeGroupMember`
  - **`requireAuth`**: `getPostsByGroup`, `commentsPage` (visibility is scoped in §2, not by role)
- This fulfills the `TODO(TICKET-XXX)` markers the PR review asked to leave at each call site — grep `TODO(TICKET-XXX)` to find them all.

### 2. Ownership stays in services (role ≠ ownership)

Keep/move into services, using `isGroupCreator/isGroupAdmin/isGroupMember` from `groupPermissions.js`:

- `addGroupAdmin` / `removeGroupAdmin` / `removeGroupMember` → only group creator or existing admins (domain error `FORBIDDEN`-style code, e.g. `NOT_GROUP_ADMIN`)
- `updatePost` / `deletePost` → post author OR group admin/creator
- `updateComment` / `deleteComment` → comment author (admin override if that's the product rule)
- Domain errors go in a new `src/groups/group.constants.js` extension or a group-post constants file per AGENTS.md conventions; resolvers translate.

### 3. Read scoping

- `getPostsByGroup(groupId)`: keep the membership check from review, but move it behind the service and scope at query level where practical. Non-members get empty page or NOT_FOUND — never FORBIDDEN (anti-enumeration doctrine).
- `commentsPage`: verify requester is a member of the owning group before returning.
- Decide: are groups public-read? If yes, §3 relaxes to `requireAuth` + public posts; flag for product decision rather than assuming.

### 4. Known #61 bugs to fix while here (from review, still open)

1. `updatePost(postId, content, images = [])` — omitted `images` erases them all. Skip when undefined.
2. Verify the blocking comments were actually fixed pre-merge (import path crash, missing export, `index.js` `GroupPost` key); if any slipped through, fix here.
3. `deleteGroup` ordering (posts before group) if still present.

## Verification

```bash
node --check <every touched file>

timeout 90 npx babel-node --presets @babel/preset-env -e "
  const idx = require('./src/resolvers');
  console.log('Q:' + Object.keys(idx.Query).length + ' M:' + Object.keys(idx.Mutation).length);
  process.exit(0);
"  # count will be > Q:22 M:32 because #61 adds queries/mutations — record the new baseline

grep -rn "TODO(TICKET-XXX)" src   # must be zero after this PR
grep -rn "getAuthenticatedMemberId" src  # must be zero
```

## Acceptance criteria

1. Zero call sites of `getAuthenticatedMemberId` / zero `TODO(TICKET-XXX)` markers.
2. All twelve mutations guarded with `requireMember`; both queries with `requireAuth`.
3. Admin/creator operations enforce via service-layer helpers, translated domain errors.
4. Non-member reads cannot enumerate group content.
5. Smoke test passes at the new resolver-count baseline; frontend group/post/comment flows unaffected for legitimate members.

## Out of scope

- Changing #61's data model, pagination utilities, or GraphQL schema.
- Making groups private/public — product decision noted in §3.
