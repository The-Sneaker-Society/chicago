# Scaffold: groups 3-layer architecture (TEACHING BRANCH)

This branch is **scaffolding, not a competing implementation**. It is stacked on
`Backendfeature/group-page-data-rules` and is **purely additive** — no existing
file is modified, no resolver is rewired, nothing here runs in production yet.
Its job is to show you *where your code should live*, with one path fully
worked and the rest as `TODO` exercises.

## What you need to learn

Our backend rule (`AGENTS.md`, "resolver → service → repository"):

```
resolvers  →  service  →  repository  →  Mongoose model
(ctx/auth +    (business     (sole owner
 error          logic +       of all DB
 translation)   domain        access)
                errors)
```

Three seams, each with one job:

1. **Resolver** — authN (who is calling?), input validation, call the service,
   translate domain error codes into human sentences. Never imports a Mongoose
   model. On this branch authN is `getAuthenticatedMemberId(ctx)` from
   `src/utils/groupPermissions.js` (there are no `src/auth/guards.js` here yet —
   those arrive when this work rebases onto `main`).
2. **Service** — business logic + authZ (are they allowed?). Takes plain values
   like `memberId` (string), **never raw `ctx`**. Throws frozen error codes
   (`new Error("GROUP_NOT_FOUND")`), never sentences. Never imports Apollo.
   Never imports another domain's *model*.
3. **Repository** — Mongoose queries for its OWN model only. No validation, no
   auth, no business rules.

## What this scaffold added (and why)

| New file | Job | Absorbs |
|---|---|---|
| `src/groups/group.repository.js` | all Group-document queries (+ member/admin mutators) | `groupQueries.getPopulatedGroup`, `groupPermissions.getGroupOrThrow` |
| `src/groups/group.constants.js` | frozen `GROUP_*` / `FORBIDDEN` codes | sentences scattered across resolvers |
| `src/groups/group.service.js` | asserts (`assertGroupMember/Admin/Creator`) + group mutations (TODO) | `isGroup*` checks + inline `findByIdAndUpdate`s in `resolvers/group.js` |
| `src/group-posts/groupPost.repository.js` | all GroupPost-document queries (+ `deleteByGroupId` for the cascade) | `groupQueries.getPostAndGroup/getPopulatedPost`, inline queries in `resolvers/groupPost.js:35-42` |
| `src/group-posts/groupPost.constants.js` | frozen `POST_*` codes | post error sentences |
| `src/group-posts/groupPost.service.js` | post business logic — **`createPost` is the worked example**, rest TODO | bodies of `resolvers/groupPost.js` mutations |
| `src/group-comments/groupComment.service.js` | comment logic (TODO — port `getPostComment.service.js`, seams only) | `src/services/getPostComment.service.js` |
| `src/utils/pagination.js` | **keep as-is** — generic, no models, no auth. The one util doing it right | — |

Planned deletions (you do these when the ports land, not in this branch):
`src/utils/groupPermissions.js`, `src/utils/groupQueries.js`.

## The worked example: `createPost` in `src/group-posts/groupPost.service.js`

Read it top to bottom — one vertical slice of the whole pattern:

1. Validate input in the service (`POST_CONTENT_REQUIRED`).
2. Fetch the group through **its repository** (`groupRepository.findById`) —
   never `import GroupsModel` into a post file.
3. AuthZ through the owning domain's asserts (`groupService.assertGroupMember`).
4. Persist through **our repository** (`groupPostRepository.create`) — no
   `new GroupPostModel()` in services or resolvers.
5. The commented block above it shows the thin resolver you write when
   porting: `getAuthenticatedMemberId(ctx)` → `service.createPost(memberId,
   ...)` → `try/catch` translating codes to sentences.

## Exercises (do them in order)

- [ ] **1. `listByGroup`** — port `resolvers/groupPost.js:21`. Keep the
  null-author filter but apply it *before* `buildPage` — the current line 44
  filters after counting, so `totalCount`/`hasMore` lie.
- [ ] **2. `updatePost` / `deletePost` / `toggleLike`** — port from
  `resolvers/groupPost.js:104/134/151`. Note the two different authZ shapes:
  author-ownership (`String(post.author) === memberId`) vs group-role
  (`assertGroupAdmin`). `deletePost` needs both.
- [ ] **3. Comments** — port `getPostComment.service.js` into
  `groupComment.service.js` changing only the seams (see the file header:
  `memberId` not `ctx`, asserts not `isGroup*`, codes not sentences). This file
  is already closest to the target shape.
- [ ] **4. Group mutations** — port `joinGroup` / `leaveGroup` / `addGroupAdmin` /
  `removeGroupAdmin` / `removeGroupMember` (`resolvers/group.js:102-207`) into
  `groupService` + repo mutators. ⚠️ `leaveGroup:121` calls undefined
  `requireAuthenticatedMember(ctx)` — guaranteed `ReferenceError`. Fix it in
  the port.
- [ ] **5. Rewire + delete** — thin the resolvers (guard → service →
  translate), point `deleteGroup`'s cascade at
  `groupPostRepository.deleteByGroupId`, then delete `groupPermissions.js`
  and `groupQueries.js`.
- [ ] **6. Rebase onto `main`** — `main` now has `src/groups/` + `src/auth/guards.js`
  with the same shape as this scaffold (they will conflict; favor `main`'s and
  re-apply your ports). Swap `getAuthenticatedMemberId(ctx)` for
  `requireMember` + `String(ctx.dbUser._id)`.

## Can services call services?

Short version (full policy: `AGENTS.md` rule 4, see PR #87):

- Need another domain's **data**? Import its **repository**.
  (`groupPostService` → `groupRepository`. ✅ used in the worked example.)
- Need another domain's **wrapped logic** (validation, invariants)? You may
  call its **service** (e.g. `groupService.assertGroupMember`), one direction
  only — never A→B→A. Document the direction with a comment.
- Need **infrastructure** (image upload, Stripe, S3, email, Redis)? Call it
  freely from any service. Posts take `images: [URLs]` as data — the upload
  ticket comes from `imageService` separately, then the URL is passed in.
- Combining two domains into one response (contracts + groups feed)? The
  **resolver** calls both services and passes plain data into a combine
  function. That's orchestration, and it's the resolver's job.

## Verify

```bash
node --check src/groups/*.js src/group-posts/*.js src/group-comments/*.js
```

Scaffold files are intentionally not wired to resolvers, so the resolver
`Q:/M:` smoke-test counts must not change. Each ported path should be checked
with a real GraphQL round-trip (`createPost` → `likePost` → `deletePost`;
`joinGroup` → `leaveGroup`) before requesting re-review.
