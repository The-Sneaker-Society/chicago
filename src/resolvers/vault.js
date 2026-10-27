import { UserInputError } from "apollo-server-core";
import { requireMember, requireAdmin } from "../auth/guards";
import { memberRepository } from "../members/member.repository";
import { vaultService } from "../vault/vault.service";
import { vaultError } from "../vault/vault.constants";

// Map service domain-error codes to client-facing Apollo errors. Unknown errors
// bubble up unchanged.
const MESSAGES = {
  [vaultError.notFound]: "Vault submission not found",
  [vaultError.notOwner]: "Not authorized for this submission",
  [vaultError.consentRequired]: "You must accept consent to submit to the Vault",
  [vaultError.mediaRequired]: "At least one media URL is required",
  [vaultError.titleRequired]: "Title is required",
  [vaultError.notEditable]: "Only draft or pending submissions can be modified",
  [vaultError.rejectNotesRequired]: "Notes are required when rejecting a submission",
  [vaultError.notApproved]: "Submission must be approved before it can be published",
};

const translate = (e) => (MESSAGES[e.message] ? new UserInputError(MESSAGES[e.message]) : e);

const run = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    throw translate(e);
  }
};

// Member-facing: requireMember guarantees ctx.dbUser is the member doc.
// Admin-facing (queue + moderation): requireAdmin. Admins have no member row,
// so moderation records no moderatedById (model allows null). Capturing admin
// identity would need a new field (e.g. moderatedByClerkId) — a model migration
// deferred for review, flagged in the PR.
const Query = {
  vaultSubmissions: requireMember((parent, args, ctx) =>
    vaultService.listForMember(ctx.dbUser._id)
  ),

  vaultSubmissionById: requireMember((parent, args, ctx) =>
    run(() => vaultService.getForMember(args.id, ctx.dbUser._id))
  ),

  adminVaultQueue: requireAdmin((parent, args) =>
    vaultService.adminQueue({ status: args.status, limit: args.limit, offset: args.offset })
  ),
};

const Mutation = {
  createVaultSubmission: requireMember((parent, args, ctx) =>
    run(() => vaultService.create(ctx.dbUser._id, args.data))
  ),

  updateVaultSubmission: requireMember((parent, args, ctx) =>
    run(() => vaultService.update(args.id, ctx.dbUser._id, args.data))
  ),

  deleteVaultSubmission: requireMember((parent, args, ctx) =>
    run(() => vaultService.remove(args.id, ctx.dbUser._id))
  ),

  approveVaultSubmission: requireAdmin((parent, args) =>
    run(() => vaultService.approve(args.id, null, args.notes))
  ),

  rejectVaultSubmission: requireAdmin((parent, args) =>
    run(() => vaultService.reject(args.id, null, args.notes))
  ),

  featureVaultSubmission: requireAdmin((parent, args) =>
    run(() => vaultService.setFeatured(args.id, args.featured))
  ),

  publishVaultSubmission: requireAdmin((parent, args) =>
    run(() => vaultService.publish(args.id))
  ),
};

const toIso = (v) => (v instanceof Date ? v.toISOString() : v != null ? String(v) : null);

const Vault = {
  // Returns the full member doc; the PublicMember GraphQL type gates which
  // fields are actually exposed to the client.
  member(parent) {
    return memberRepository.findById(parent.memberId);
  },
  createdAt: (parent) => toIso(parent.createdAt),
  updatedAt: (parent) => toIso(parent.updatedAt),
  publishedAt: (parent) => toIso(parent.publishedAt),
};

export default { Query, Mutation, Vault };
