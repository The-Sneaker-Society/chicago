import { imageService } from './image.service.js';

const Mutation = {
  requestImageUpload: async (_, { filename, fileType }, ctx) => {
    const clerkUserId = ctx?.userId || ctx?.auth?.userId;
    if (!clerkUserId) throw new Error("Unauthorized");
    return await imageService.getMockUploadTicket(clerkUserId, filename);
  },

  confirmImageUpload: async (_, { key, filename, fileType }, ctx) => {
    const clerkUserId = ctx?.userId || ctx?.auth?.userId;
    if (!clerkUserId) throw new Error("Unauthorized");
    const ownerDbId = ctx.dbUser?._id?.toString() || ctx?.auth?.dbUser?._id?.toString() || clerkUserId;
    const res = await imageService.saveImagePointer(ownerDbId, key, filename, fileType);
    const doc = typeof res.toObject === 'function' ? res.toObject() : res;
    return {
      ...doc,
      id: doc._id ? doc._id.toString() : doc.id,
    };
  }
  ,
  updateImage: async (_, { id, filename, fileType }, ctx) => {
    const clerkUserId = ctx?.userId || ctx?.auth?.userId;
    if (!clerkUserId) throw new Error("Unauthorized");
    const ownerDbId = ctx.dbUser?._id?.toString() || ctx?.auth?.dbUser?._id?.toString() || clerkUserId;

    // Ensure the image belongs to the requester
    const existing = await imageService.getImageById(id);
    if (!existing) throw new Error('Image not found');
    if (existing.userId !== ownerDbId) throw new Error('Unauthorized');

    const updated = await imageService.updateImageById(id, { filename, fileType });
    const doc = typeof updated.toObject === 'function' ? updated.toObject() : updated;
    return {
      ...doc,
      id: doc._id ? doc._id.toString() : doc.id,
    };
  },

  deleteImage: async (_, { id }, ctx) => {
    const clerkUserId = ctx?.userId || ctx?.auth?.userId;
    if (!clerkUserId) throw new Error("Unauthorized");
    const ownerDbId = ctx.dbUser?._id?.toString() || ctx?.auth?.dbUser?._id?.toString() || clerkUserId;

    const existing = await imageService.getImageById(id);
    if (!existing) throw new Error('Image not found');
    if (existing.userId !== ownerDbId) throw new Error('Unauthorized');

    await imageService.deleteImageById(id);
    return true;
  }
};

const Query = {
  getUserImages: async (_, __, ctx) => {
    const clerkUserId = ctx?.userId || ctx?.auth?.userId;
    if (!clerkUserId) throw new Error("Unauthorized");
    const ownerDbId = ctx.dbUser?._id?.toString() || ctx?.auth?.dbUser?._id?.toString() || clerkUserId;
    const images = await imageService.getImagesByUser(ownerDbId);

    return Promise.all(images.map(async (img) => {
      const doc = typeof img.toObject === 'function' ? img.toObject() : img;
      const idVal = doc._id ? doc._id.toString() : doc.id;

      // Try building a view URL using the Clerk userId first; if the key namespace
      // was generated with a different owner id (e.g., MongoDB _id), fall back
      // to using the ownerDbId so ownership checks succeed.
      let url;
      try {
        url = await imageService.getMockViewUrl(clerkUserId, doc.key);
      } catch (err) {
        const fallbackOwner = ownerDbId;
        try {
          url = await imageService.getMockViewUrl(fallbackOwner, doc.key);
        } catch (err2) {
          // If both fail, surface a generic placeholder instead of throwing
          url = `https://placehold.co/600x400?text=Unavailable`;
        }
      }

      return {
        ...doc,
        id: idVal,
        url,
      };
    }));
  }
};

export default { Query, Mutation };
