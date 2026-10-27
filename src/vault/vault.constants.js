// Frozen vocabularies for the Vault domain. Persisted string values (status,
// category) must never change without a data migration.

export const vaultStatus = Object.freeze({
  draft: "draft",
  pending: "pending",
  underReview: "underReview",
  approved: "approved",
  rejected: "rejected",
  published: "published",
});

export const vaultCategory = Object.freeze({
  customization: "customization",
  merchandise: "merchandise",
  photo: "photo",
  video: "video",
  other: "other",
});

// A submission may only be edited/deleted by its owner while still unmoderated.
export const EDITABLE_STATUSES = Object.freeze([vaultStatus.draft, vaultStatus.pending]);

// Domain error codes thrown by the service; resolvers translate to Apollo errors.
export const vaultError = Object.freeze({
  memberNotFound: "MEMBER_NOT_FOUND",
  notFound: "VAULT_SUBMISSION_NOT_FOUND",
  notOwner: "VAULT_NOT_AUTHORIZED",
  consentRequired: "VAULT_CONSENT_REQUIRED",
  mediaRequired: "VAULT_MEDIA_REQUIRED",
  titleRequired: "VAULT_TITLE_REQUIRED",
  notEditable: "VAULT_NOT_EDITABLE",
  rejectNotesRequired: "VAULT_REJECT_NOTES_REQUIRED",
  notApproved: "VAULT_NOT_APPROVED",
});
