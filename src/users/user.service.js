import { userRepository } from "./user.repository.js";

export const userService = {
  async getUsers() {
    return await userRepository.findAll();
  },

  /**
   * Resolves the current user by their Clerk id.
   * Throws a plain domain error that the resolver translates.
   */
  async getCurrentUser(clerkId) {
    const user = await userRepository.findByClerkId(clerkId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return user;
  },

  /**
   * Creates a new user.
   * - Checks email availability first (domain error EMAIL_TAKEN).
   * - Applies defaults (isActive: true).
   * - Delegates persistence to the repository.
   */
  async createUser(input) {
    const {
      clerkId,
      email,
      firstName,
      lastName,
      phoneNumber,
      addressLineOne,
      addressLineTwo,
      state,
      zipcode,
    } = input;

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error("EMAIL_TAKEN");
    }

    const created = await userRepository.createUser({
      email,
      clerkId,
      firstName,
      lastName,
      phoneNumber,
      addressLineOne,
      addressLineTwo,
      state,
      zipcode,
      isActive: true,
    });

    return { ...created._doc, id: created._id };
  },

  /**
   * Updates the requester's own profile. `requesterContextId` is the Clerk id
   * from ctx.userId; it is resolved to the db user id before updating since
   * the repository updates by Mongo _id.
   */
  async updateUser(requesterContextId, updates) {
    const user = await userRepository.findByClerkId(requesterContextId);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    return await userRepository.updateUserById(user._id, { ...updates });
  },

  /**
   * Contracts where the parent user is the client (filtered at the DB level).
   */
  async getContractsForUser(parent) {
    return await userRepository.findContractsByClient(parent.id);
  },

  async getChatsForUser(userId) {
    return await userRepository.findChatsByUserId(userId);
  },
};
