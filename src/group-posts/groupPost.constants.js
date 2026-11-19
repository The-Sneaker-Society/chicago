/**
 * Post/comment deletion policy:
 * - Authors may delete their own content without current group membership.
 * - Non-authors must be the group creator or an admin.
 * - The parent group must still exist.
 *
 * Creating, editing, and liking content still require current membership.
 */
export const groupPostErrors = Object.freeze({
  notFound: "POST_NOT_FOUND",
  groupNotFound: "GROUP_NOT_FOUND",
  forbidden: "FORBIDDEN",
  contentRequired: "POST_CONTENT_REQUIRED",
  commentNotFound: "COMMENT_NOT_FOUND",
  commentContentRequired: "COMMENT_CONTENT_REQUIRED",
});
