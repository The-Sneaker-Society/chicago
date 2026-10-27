import { vaultRepository } from "./vault.repository";
import { vaultStatus, EDITABLE_STATUSES, vaultError } from "./vault.constants";

// Business logic for the Vault. No Apollo imports — throws plain domain-error
// codes (vault.constants) that resolvers translate. The repository is injectable
// so the rules can be unit-tested without a database; it defaults to the real one.

const err = (code) => new Error(code);

const assertOwner = (submission, memberId) => {
  if (!submission) throw err(vaultError.notFound);
  if (String(submission.memberId) !== String(memberId)) throw err(vaultError.notOwner);
};

export const vaultService = {
  listForMember(memberId, repo = vaultRepository) {
    return repo.findByMember(memberId);
  },

  async getForMember(id, memberId, repo = vaultRepository) {
    const submission = await repo.findActiveById(id);
    assertOwner(submission, memberId);
    return submission;
  },

  async adminQueue({ status, limit = 20, offset = 0 } = {}, repo = vaultRepository) {
    const { totalCount, items } = await repo.queue({ status, limit, offset });
    const hasMore = offset + items.length < totalCount;
    return { items, totalCount, hasMore, nextOffset: hasMore ? offset + limit : null };
  },

  create(memberId, data, repo = vaultRepository) {
    if (!data.consentAccepted) throw err(vaultError.consentRequired);
    if (!data.mediaUrls || data.mediaUrls.length < 1) throw err(vaultError.mediaRequired);
    if (!data.title || !data.title.trim()) throw err(vaultError.titleRequired);

    const status = data.status === vaultStatus.draft ? vaultStatus.draft : vaultStatus.pending;
    return repo.create({
      memberId,
      title: data.title,
      description: data.description,
      category: data.category,
      platforms: data.platforms || [],
      mediaUrls: data.mediaUrls,
      thumbnailUrl: data.thumbnailUrl,
      consentAccepted: data.consentAccepted,
      status,
    });
  },

  async update(id, memberId, data, repo = vaultRepository) {
    const submission = await repo.findActiveById(id);
    assertOwner(submission, memberId);
    if (!EDITABLE_STATUSES.includes(submission.status)) throw err(vaultError.notEditable);
    return repo.updateById(id, { ...data });
  },

  async remove(id, memberId, repo = vaultRepository) {
    const submission = await repo.findActiveById(id);
    assertOwner(submission, memberId);
    if (!EDITABLE_STATUSES.includes(submission.status)) throw err(vaultError.notEditable);
    await repo.softDelete(id);
    return true;
  },

  async approve(id, moderatorId, notes, repo = vaultRepository) {
    const updated = await repo.updateById(id, {
      status: vaultStatus.approved,
      isApproved: true,
      ...(notes && { adminNotes: notes }),
      moderatedById: moderatorId,
      moderatedAt: new Date(),
    });
    if (!updated) throw err(vaultError.notFound);
    return updated;
  },

  async reject(id, moderatorId, notes, repo = vaultRepository) {
    if (!notes) throw err(vaultError.rejectNotesRequired);
    const updated = await repo.updateById(id, {
      status: vaultStatus.rejected,
      isApproved: false,
      adminNotes: notes,
      moderatedById: moderatorId,
      moderatedAt: new Date(),
    });
    if (!updated) throw err(vaultError.notFound);
    return updated;
  },

  async setFeatured(id, featured, repo = vaultRepository) {
    const updated = await repo.updateById(id, { isFeatured: featured });
    if (!updated) throw err(vaultError.notFound);
    return updated;
  },

  async publish(id, repo = vaultRepository) {
    const submission = await repo.findById(id);
    if (!submission) throw err(vaultError.notFound);
    if (!submission.isApproved) throw err(vaultError.notApproved);
    return repo.updateById(id, { status: vaultStatus.published, publishedAt: new Date() });
  },
};
