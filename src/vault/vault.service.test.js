import assert from "assert";
import { vaultService } from "./vault.service";
import { vaultStatus, vaultError } from "./vault.constants";

let passed = 0;
const test = (name, fn) => {
  Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log("  ok  ", name);
    })
    .catch((e) => {
      console.log("  FAIL", name, "\n       ", e.message);
      process.exitCode = 1;
    });
};

// In-memory fake repository capturing what the service asks of it.
const fakeRepo = (overrides = {}) => ({
  findByMember: async () => [],
  findActiveById: async () => null,
  findById: async () => null,
  queue: async () => ({ totalCount: 0, items: [] }),
  create: async (doc) => ({ _id: "new", ...doc }),
  updateById: async (id, updates) => ({ _id: id, ...updates }),
  softDelete: async (id) => ({ _id: id, deletedAt: new Date() }),
  ...overrides,
});

const MEMBER = "m1";
const OTHER = "m2";
const validData = { title: "Custom AJ1", category: "customization", mediaUrls: ["u1"], consentAccepted: true };

const expectError = async (fn, code) => {
  try {
    await fn();
    throw new Error(`expected ${code}, but it resolved`);
  } catch (e) {
    assert.equal(e.message, code);
  }
};

test("create requires consent, media, and title", async () => {
  await expectError(() => vaultService.create(MEMBER, { ...validData, consentAccepted: false }, fakeRepo()), vaultError.consentRequired);
  await expectError(() => vaultService.create(MEMBER, { ...validData, mediaUrls: [] }, fakeRepo()), vaultError.mediaRequired);
  await expectError(() => vaultService.create(MEMBER, { ...validData, title: "  " }, fakeRepo()), vaultError.titleRequired);
});

test("create defaults to pending; explicit draft respected", async () => {
  const pending = await vaultService.create(MEMBER, validData, fakeRepo());
  assert.equal(pending.status, vaultStatus.pending);
  const draft = await vaultService.create(MEMBER, { ...validData, status: "draft" }, fakeRepo());
  assert.equal(draft.status, vaultStatus.draft);
  // any non-draft status string still becomes pending (can't self-approve)
  const sneaky = await vaultService.create(MEMBER, { ...validData, status: "approved" }, fakeRepo());
  assert.equal(sneaky.status, vaultStatus.pending);
});

test("getForMember enforces ownership and existence", async () => {
  await expectError(() => vaultService.getForMember("x", MEMBER, fakeRepo()), vaultError.notFound);
  const repo = fakeRepo({ findActiveById: async () => ({ _id: "x", memberId: OTHER }) });
  await expectError(() => vaultService.getForMember("x", MEMBER, repo), vaultError.notOwner);
  const mine = fakeRepo({ findActiveById: async () => ({ _id: "x", memberId: MEMBER }) });
  assert.equal((await vaultService.getForMember("x", MEMBER, mine))._id, "x");
});

test("update/delete only on draft or pending, owner only", async () => {
  const approved = fakeRepo({ findActiveById: async () => ({ _id: "x", memberId: MEMBER, status: vaultStatus.approved }) });
  await expectError(() => vaultService.update("x", MEMBER, { title: "new" }, approved), vaultError.notEditable);
  await expectError(() => vaultService.remove("x", MEMBER, approved), vaultError.notEditable);
  const notOwner = fakeRepo({ findActiveById: async () => ({ _id: "x", memberId: OTHER, status: vaultStatus.pending }) });
  await expectError(() => vaultService.update("x", MEMBER, { title: "new" }, notOwner), vaultError.notOwner);
  const ok = fakeRepo({ findActiveById: async () => ({ _id: "x", memberId: MEMBER, status: vaultStatus.pending }) });
  assert.equal((await vaultService.update("x", MEMBER, { title: "new" }, ok)).title, "new");
  assert.equal(await vaultService.remove("x", MEMBER, ok), true);
});

test("adminQueue computes pagination", async () => {
  const repo = fakeRepo({ queue: async () => ({ totalCount: 25, items: new Array(20).fill({}) }) });
  const page = await vaultService.adminQueue({ limit: 20, offset: 0 }, repo);
  assert.equal(page.totalCount, 25);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextOffset, 20);
  const last = await vaultService.adminQueue({ limit: 20, offset: 20 }, fakeRepo({ queue: async () => ({ totalCount: 25, items: new Array(5).fill({}) }) }));
  assert.equal(last.hasMore, false);
  assert.equal(last.nextOffset, null);
});

test("reject requires notes; approve/reject set moderation fields", async () => {
  await expectError(() => vaultService.reject("x", null, "", fakeRepo()), vaultError.rejectNotesRequired);
  let captured;
  const repo = fakeRepo({ updateById: async (id, u) => { captured = u; return { _id: id, ...u }; } });
  await vaultService.approve("x", null, "looks great", repo);
  assert.equal(captured.status, vaultStatus.approved);
  assert.equal(captured.isApproved, true);
  assert.equal(captured.adminNotes, "looks great");
  await vaultService.reject("x", null, "blurry photos", repo);
  assert.equal(captured.status, vaultStatus.rejected);
  assert.equal(captured.isApproved, false);
});

test("publish requires an approved submission", async () => {
  await expectError(() => vaultService.publish("x", fakeRepo({ findById: async () => null })), vaultError.notFound);
  await expectError(() => vaultService.publish("x", fakeRepo({ findById: async () => ({ _id: "x", isApproved: false }) })), vaultError.notApproved);
  let captured;
  const repo = fakeRepo({ findById: async () => ({ _id: "x", isApproved: true }), updateById: async (id, u) => { captured = u; return { _id: id, ...u }; } });
  await vaultService.publish("x", repo);
  assert.equal(captured.status, vaultStatus.published);
  assert.ok(captured.publishedAt instanceof Date);
});

process.on("exit", () => console.log(`\n${passed} passed`));
