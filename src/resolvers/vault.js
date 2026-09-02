import MemberModel from "../models/Member.model";
import VaultModel from "../models/Vault.model";

const PUBLIC_MEMBER_SELECT = "firstName lastName businessName state isActive subscriptionStatus";

const Query = {
  async vaultSubmissions(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      return VaultModel.find({ memberId: currentMember._id, deletedAt: null }).sort({ createdAt: -1 });
    } catch (e) {
      throw new Error(e);
    }
  },

  async vaultSubmissionById(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const submission = await VaultModel.findOne({ _id: args.id, deletedAt: null });
      if (!submission) throw new Error("Vault submission not found");

      if (String(submission.memberId) !== String(currentMember._id)) {
        throw new Error("Not authorized to view this submission");
      }

      return submission;
    } catch (e) {
      throw new Error(e);
    }
  },

  async adminVaultQueue(parent, args, ctx) {
    try {
      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;

      const filter = { deletedAt: null };
      if (args.status) filter.status = args.status;

      const [totalCount, items] = await Promise.all([
        VaultModel.countDocuments(filter),
        VaultModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit),
      ]);

      const hasMore = offset + items.length < totalCount;
      const nextOffset = hasMore ? offset + limit : null;

      return { items, totalCount, hasMore, nextOffset };
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Mutation = {
  async createVaultSubmission(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const { data } = args;

      if (!data.consentAccepted) {
        throw new Error("You must accept consent to submit to the Vault");
      }

      if (!data.mediaUrls || data.mediaUrls.length < 1) {
        throw new Error("At least one media URL is required");
      }

      if (!data.title || !data.title.trim()) {
        throw new Error("Title is required");
      }

      const status = data.status === "draft" ? "draft" : "pending";

      const vault = new VaultModel({
        memberId: currentMember._id,
        title: data.title,
        description: data.description,
        category: data.category,
        platforms: data.platforms || [],
        mediaUrls: data.mediaUrls,
        thumbnailUrl: data.thumbnailUrl,
        consentAccepted: data.consentAccepted,
        status,
      });

      return vault.save();
    } catch (e) {
      throw new Error(e);
    }
  },

  async updateVaultSubmission(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const submission = await VaultModel.findOne({ _id: args.id, deletedAt: null });
      if (!submission) throw new Error("Vault submission not found");

      if (String(submission.memberId) !== String(currentMember._id)) {
        throw new Error("Not authorized to update this submission");
      }

      if (!["draft", "pending"].includes(submission.status)) {
        throw new Error("Only draft or pending submissions can be updated");
      }

      const updated = await VaultModel.findByIdAndUpdate(
        args.id,
        { ...args.data },
        { new: true }
      );

      return updated;
    } catch (e) {
      throw new Error(e);
    }
  },

  async deleteVaultSubmission(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const submission = await VaultModel.findOne({ _id: args.id, deletedAt: null });
      if (!submission) throw new Error("Vault submission not found");

      if (String(submission.memberId) !== String(currentMember._id)) {
        throw new Error("Not authorized to delete this submission");
      }

      if (!["draft", "pending"].includes(submission.status)) {
        throw new Error("Only draft or pending submissions can be deleted");
      }

      await VaultModel.findByIdAndUpdate(args.id, { deletedAt: new Date() });

      return true;
    } catch (e) {
      throw new Error(e);
    }
  },

  async approveVaultSubmission(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      const updated = await VaultModel.findByIdAndUpdate(
        args.id,
        {
          status: "approved",
          isApproved: true,
          ...(args.notes && { adminNotes: args.notes }),
          moderatedById: currentMember._id,
          moderatedAt: new Date(),
        },
        { new: true }
      );

      if (!updated) throw new Error("Vault submission not found");

      return updated;
    } catch (e) {
      throw new Error(e);
    }
  },

  async rejectVaultSubmission(parent, args, ctx) {
    try {
      const currentMember = await MemberModel.findOne({ clerkId: ctx.userId });
      if (!currentMember) throw new Error("Member not found");

      if (!args.notes) throw new Error("Notes are required when rejecting a submission");

      const updated = await VaultModel.findByIdAndUpdate(
        args.id,
        {
          status: "rejected",
          isApproved: false,
          adminNotes: args.notes,
          moderatedById: currentMember._id,
          moderatedAt: new Date(),
        },
        { new: true }
      );

      if (!updated) throw new Error("Vault submission not found");

      return updated;
    } catch (e) {
      throw new Error(e);
    }
  },

  async featureVaultSubmission(parent, args, ctx) {
    try {
      const updated = await VaultModel.findByIdAndUpdate(
        args.id,
        { isFeatured: args.featured },
        { new: true }
      );

      if (!updated) throw new Error("Vault submission not found");

      return updated;
    } catch (e) {
      throw new Error(e);
    }
  },

  async publishVaultSubmission(parent, args, ctx) {
    try {
      const submission = await VaultModel.findById(args.id);
      if (!submission) throw new Error("Vault submission not found");

      if (!submission.isApproved) {
        throw new Error("Submission must be approved before it can be published");
      }

      const updated = await VaultModel.findByIdAndUpdate(
        args.id,
        { status: "published", publishedAt: new Date() },
        { new: true }
      );

      return updated;
    } catch (e) {
      throw new Error(e);
    }
  },
};

const Vault = {
  async member(parent) {
    return MemberModel.findById(parent.memberId).select(PUBLIC_MEMBER_SELECT);
  },
  createdAt: (parent) =>
    parent.createdAt instanceof Date
      ? parent.createdAt.toISOString()
      : String(parent.createdAt),
  updatedAt: (parent) =>
    parent.updatedAt instanceof Date
      ? parent.updatedAt.toISOString()
      : String(parent.updatedAt),
  publishedAt: (parent) =>
    parent.publishedAt
      ? parent.publishedAt instanceof Date
        ? parent.publishedAt.toISOString()
        : String(parent.publishedAt)
      : null,
};

export default { Query, Mutation, Vault };
