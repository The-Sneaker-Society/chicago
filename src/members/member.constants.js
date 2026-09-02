export const serviceMenuItem = Object.freeze({
  maxItems: 12,
  maxNameLen: 60,
  maxPriceCents: 50000, // legacy name — value is in cents (500 dollars); service validates dollars 1-500
});

export const memberErrors = Object.freeze({
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  INVALID_MEMBER_ID: "INVALID_MEMBER_ID",
});
