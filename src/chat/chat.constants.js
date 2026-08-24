/**
 * Single source of truth for chat vocabularies. Values are the exact
 * strings persisted in Mongo / returned by the API — never change them here
 * without a data migration.
 */

/**
 * Domain error codes thrown by the chat service and translated to
 * user-facing messages by resolvers.
 */
export const chatErrors = Object.freeze({
  CHAT_NOT_FOUND: "CHAT_NOT_FOUND",
});
