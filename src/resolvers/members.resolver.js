import dotenv from "dotenv";
import { UserInputError } from "apollo-server-core";
import { memberService } from "../members/member.service.js";
import { requireAdmin, requireAuth, requireMember } from "../auth/guards.js";

dotenv.config({ path: "config.env" });

const Query = {
  // Directory dump — admin-only (plan.md Wave 3)
  members: requireAdmin(async (parent, args, ctx, info) => {
    try {
      return await memberService.getMembers();
    } catch (e) {
      throw new Error(e);
    }
  }),
  memberById: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.getCurrentMember(ctx.userId);
    } catch (e) {
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new Error("Member not found");
      }
      throw new Error(e);
    }
  }),
  currentMember: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.getCurrentMember(ctx.userId);
    } catch (e) {
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new Error("Member not found");
      }
      throw new Error(e);
    }
  }),
  stripeWidgetData: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.getStripeWidgetData(ctx.dbUser);
    } catch (e) {
      throw new Error(e);
    }
  }),
  subscriptionDetails: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.getSubscriptionDetails(
        ctx.dbUser.stripeCustomerId
      );
    } catch (e) {
      throw new Error(e);
    }
  }),

  revenueSummary: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.getRevenueSummary(ctx.dbUser.contracts);
    } catch (e) {
      throw new Error(e);
    }
  }),

  getDiscoverMembers: requireAuth(async (parent, args, ctx) => {
    try {
      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;
      return await memberService.getDiscoverMembers(ctx.userId, {
        limit,
        offset,
      });
    } catch (e) {
      throw new Error(e);
    }
  }),

  getServiceMenu: async (parent, args, ctx) => {
    try {
      return await memberService.getServiceMenu(args.memberId);
    } catch (e) {
      if (e.message === "INVALID_MEMBER_ID") throw new UserInputError("Invalid member ID");
      if (e.message === "MEMBER_NOT_FOUND") throw new Error("Member not found");
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createMember(parent, args, ctx, info) {
    const { clerkId, email } = args.data || {};
    if (!clerkId || !email) {
      throw new UserInputError("clerkId and email are required", {
        errors: {
          email: !email ? "Email is required." : undefined,
          clerkId: !clerkId ? "clerkId is required." : undefined,
        },
      });
    }

    try {
      return await memberService.createMember(args.data);
    } catch (error) {
      if (error.message === "CLERK_ID_TAKEN") {
        throw new UserInputError(
          "An account with this ID already exists. If this is wrong please contact support",
          {
            errors: {
              clerkId: "An account with this ID already exists.",
            },
          }
        );
      }
      console.error(error);
      throw error;
    }
  },
  updateMember: requireMember(async (parent, args, ctx, info) => {
    // ctx.dbUser._id is the Mongo id for the requester's member document.
    try {
      return await memberService.updateMember(ctx.dbUser._id, {
        ...args.data,
      });
    } catch (error) {
      throw error;
    }
  }),
  deleteMember: requireMember(async (parent, args, ctx, info) => {
    // Uses ctx.dbUser._id — the same id source as updateMember. The previous
    // implementation used ctx.id, which did not match the Mongo _id used by
    // every other mutation in this domain.
    try {
      return await memberService.deleteMember(ctx.dbUser._id);
    } catch (e) {
      throw new Error(e);
    }
  }),
  onboardMemberToStripe: requireMember(async (parent, args, ctx, info) => {
    // ctx.userId is the Clerk id; the service resolves it to the db member id.
    try {
      return await memberService.onboardMemberToStripe(ctx.userId);
    } catch (error) {
      throw new Error(error);
    }
  }),
  resumeAccountOnboarding: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.resumeAccountOnboarding(ctx.dbUser._id);
    } catch (error) {
      throw new Error(error);
    }
  }),
  syncStripeData: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.syncStripeData(ctx.dbUser.stripeCustomerId);
    } catch (error) {
      if (error.message === "STRIPE_CUSTOMER_ID_MISSING") {
        throw new Error("Stripe customer ID not found for this user.");
      }
      throw new Error("Failed to sync Stripe data.");
    }
  }),
  createMemberSubsctiprion: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.createSubscriptionForCurrentMember(
        ctx.dbUser
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }),
  cancelSubscription: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.cancelSubscription(
        ctx.dbUser.stripeCustomerId
      );
    } catch {
      throw new Error("Failed to cancel subscription");
    }
  }),
  pauseSubscription: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.pauseSubscription(
        ctx.dbUser.stripeCustomerId
      );
    } catch {
      throw new Error("Failed to pause subscription");
    }
  }),
  reactivateSubscription: requireMember(async (parent, args, ctx, info) => {
    try {
      return await memberService.reactivateSubscription(
        ctx.dbUser.stripeCustomerId
      );
    } catch {
      throw new Error("Failed to reactivate subscription");
    }
  }),

  followMember: requireMember(async (parent, args, ctx) => {
    try {
      return await memberService.followMember(ctx.userId, args.memberId);
    } catch (e) {
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new Error("Member not found");
      }
      if (e.message === "TARGET_MEMBER_NOT_FOUND") {
        throw new Error("Target member not found");
      }
      throw new Error(e);
    }
  }),

  unfollowMember: requireMember(async (parent, args, ctx) => {
    try {
      return await memberService.unfollowMember(ctx.userId, args.memberId);
    } catch (e) {
      if (e.message === "MEMBER_NOT_FOUND") {
        throw new Error("Member not found");
      }
      throw new Error(e);
    }
  }),

  upsertServiceMenu: requireMember(async (parent, args, ctx) => {
    try {
      return await memberService.upsertServiceMenu(ctx.dbUser._id, args.items);
    } catch (e) {
      if (e.message === "VALIDATION_ERROR") {
        throw new UserInputError("Invalid service menu item", { errors: { items: e.message } });
      }
      if (e.message === "INVALID_MEMBER_ID") throw new UserInputError("Invalid member ID");
      if (e.message === "MEMBER_NOT_FOUND") throw new Error("Member not found");
      throw new Error(e);
    }
  }),
};

const Member = {
  async clients(parent, args, ctx, info) {
    try {
      return await memberService.getClientsForMember(ctx.dbUser);
    } catch (e) {
      throw new Error(e);
    }
  },

  async contracts(parent, args, ctx, info) {
    try {
      return await memberService.getContractsForMember(ctx.dbUser);
    } catch (e) {
      throw new Error(e);
    }
  },
  async products(parent, args, ctx, info) {
    try {
      return await memberService.getProductsForMember(parent._id);
    } catch (e) {
      throw new Error(e);
    }
  },
  async qrWidgetData(parent, args, ctx, info) {
    try {
      return await memberService.getQrWidgetData(ctx.dbUser);
    } catch (error) {
      throw new Error(error);
    }
  },
  async chats(parent, args, ctx, info) {
    try {
      return await memberService.getChatsForMember(parent._id);
    } catch (error) {
      throw new Error(error);
    }
  },
  async isSubscribed(parent, args, ctx, info) {
    try {
      return await memberService.getIsSubscribed(parent);
    } catch (error) {
      throw new Error(error);
    }
  },
  async isOnboardedWithStripe(parent, args, ctx, info) {
    try {
      return await memberService.getIsOnboardedWithStripe(parent);
    } catch (error) {
      throw new Error(error);
    }
  },

  async following(parent) {
    try {
      return await memberService.getFollowing(parent);
    } catch (e) {
      throw new Error(e);
    }
  },

  async followers(parent) {
    try {
      return await memberService.getFollowers(parent);
    } catch (e) {
      throw new Error(e);
    }
  },

  async serviceMenu(parent) {
    // Graceful fallback for legacy docs where serviceMenu is undefined — avoids
    // non-null violation on Member.serviceMenu: [ServiceMenuItem!]!
    return parent.serviceMenu || [];
  },
};
export default { Query, Mutation, Member };
