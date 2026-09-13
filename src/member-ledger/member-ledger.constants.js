/**
 * Single source of truth for member-ledger vocabularies. Values are the exact
 * strings persisted in Mongo — never change them here without a data migration.
 */

// What the debt is for
export const ledgerEntryType = Object.freeze({
  returnLabel: "RETURN_LABEL",
  outboundShipping: "OUTBOUND_SHIPPING",
  other: "OTHER",
});

// Lifecycle of a single entry; amounts track progress, status is the flag
export const ledgerEntryStatus = Object.freeze({
  outstanding: "OUTSTANDING",
  settled: "SETTLED",
  writtenOff: "WRITTEN_OFF",
});

export const ledgerErrors = Object.freeze({
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  CONTRACT_NOT_FOUND: "CONTRACT_NOT_FOUND",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  ENTRY_NOT_FOUND: "ENTRY_NOT_FOUND",
});
