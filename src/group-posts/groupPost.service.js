import { groupPostRepository } from "./groupPost.repository.js";
import { groupPostErrors } from "./groupPost.constants.js";
import { groupRepository } from "../groups/group.repository.js";
import { groupService } from "../groups/group.service.js";
import {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  normalizeLimit,
  normalizeOffset,
  buildPage,
} from "../utils/pagination.js";

export const groupPostService = {
  async createPost(memberId, { groupId, content, images = [] }) {
    if (!content?.trim()) {
      throw new Error(groupPostErrors.contentRequired);
    }

    const group = await groupRepository.findById(groupId);
    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    groupService.assertGroupMember(group, memberId);

    return await groupPostRepository.create({
      groupId,
      author: memberId,
      content: content.trim(),
      images,
      likes: [],
      comments: [],
    });
  },

  async listByGroup(memberId, { groupId, limit, offset }) {
    const group = await groupRepository.findById(groupId);

    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    groupService.assertGroupMember(group, memberId);

    const normalizedLimit = normalizeLimit(
      limit,
      DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const normalizedOffset = normalizeOffset(offset);

    const posts = await groupPostRepository.findPageByGroup(groupId);

    const validPosts = posts.filter((post) => Boolean(post.author));

    const items = validPosts.slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit,
    );

    return buildPage({
      items,
      totalCount: validPosts.length,
      offset: normalizedOffset,
    });
  },

  async updatePost(memberId, { postId, content, images }) {
    if (!content?.trim()) {
      throw new Error(groupPostErrors.contentRequired);
    }

    const post = await groupPostRepository.findById(postId);
    if (!post) {
      throw new Error(groupPostErrors.notFound);
    }

    if (String(post.author) !== String(memberId)) {
      throw new Error(groupPostErrors.forbidden);
    }

    const group = await groupRepository.findById(post.groupId);
    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    groupService.assertGroupMember(group, memberId);

    post.content = content.trim();

    if (images !== undefined) {
      post.images = images;
    }

    await groupPostRepository.save(post);

    return await groupPostRepository.findByIdPopulated(post._id);
  },

  async deletePost(memberId, postId) {
    const post = await groupPostRepository.findById(postId);
    if (!post) {
      throw new Error(groupPostErrors.notFound);
    }

    const group = await groupRepository.findById(post.groupId);
    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    const isAuthor = String(post.author) === String(memberId);

    if (!isAuthor) {
      groupService.assertGroupAdmin(group, memberId);
    }

    const deleted = await groupPostRepository.deleteById(postId);

    return Boolean(deleted);
  },

  async toggleLike(memberId, postId) {
    const post = await groupPostRepository.findById(postId);
    if (!post) {
      throw new Error(groupPostErrors.notFound);
    }

    const group = await groupRepository.findById(post.groupId);
    if (!group) {
      throw new Error(groupPostErrors.groupNotFound);
    }

    groupService.assertGroupMember(group, memberId);

    const alreadyLiked = (post.likes || []).some(
      (id) => String(id) === String(memberId),
    );

    post.likes = alreadyLiked
      ? post.likes.filter((id) => String(id) !== String(memberId))
      : [...post.likes, memberId];

    await groupPostRepository.save(post);

    return await groupPostRepository.findByIdPopulated(post._id);
  },
};
