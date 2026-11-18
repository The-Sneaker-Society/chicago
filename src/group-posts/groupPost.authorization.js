import { groupService } from "../groups/group.service.js";

/**
 * Authors retain deletion rights after leaving or being removed.
 * Non-authors must be the group creator or an admin.
 * Callers must first resolve the content and its parent group.
 */
export const assertCanDeleteGroupContent = (group, authorId, memberId) => {
  if (String(authorId) === String(memberId)) {
    return;
  }

  groupService.assertGroupAdmin(group, memberId);
};
