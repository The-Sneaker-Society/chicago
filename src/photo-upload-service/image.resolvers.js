import { imageService } from './image.service.js';
import { requireAuth } from '../auth/guards.js';

// Role auth via guards; per-image ownership checks stay in the resolvers.
const Mutation = {
  requestImageUpload: requireAuth(async (_, { filename, fileType }, ctx) => {
    return await imageService.getMockUploadTicket(ctx.userId, filename);
  }),

  confirmImageUpload: requireAuth(async (_, { key, filename, fileType }, ctx) => {
    const ownerDbId = ctx.dbUser._id.toString();
    const res = await imageService.saveImagePointer(ownerDbId, key, filename, fileType);
    const doc = typeof res.toObject === 'function' ? res.toObject() : res;
    const idVal = doc._id ? doc._id.toString() : doc.id;

    let url;
    try {
      url = await imageService.getMockViewUrl(ctx.userId, doc.key);
    } catch {
      try {
        url = await imageService.getMockViewUrl(ownerDbId, doc.key);
      } catch {
        url = `https://placehold.co/600x400?text=Unavailable`;
      }
    }

    return { ...doc, id: idVal, url };
  }),

  updateImage: requireAuth(async (_, { id, filename, fileType }, ctx) => {
    const ownerDbId = ctx.dbUser._id.toString();

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
  }),

  deleteImage: requireAuth(async (_, { id }, ctx) => {
    const ownerDbId = ctx.dbUser._id.toString();

    const existing = await imageService.getImageById(id);
    if (!existing) throw new Error('Image not found');
    if (existing.userId !== ownerDbId) throw new Error('Unauthorized');

    await imageService.deleteImageById(id);
    return true;
  })
};

const Query = {
  getImage: requireAuth(async (_, { id }, ctx) => {
    const ownerDbId = ctx.dbUser._id.toString();

    const img = await imageService.getImageById(id);
    if (!img) return null;
    if (img.userId !== ownerDbId) throw new Error('Unauthorized');

    const doc = typeof img.toObject === 'function' ? img.toObject() : img;
    const idVal = doc._id ? doc._id.toString() : doc.id;

    let url;
    try {
      url = await imageService.getMockViewUrl(ctx.userId, doc.key);
    } catch {
      try {
        url = await imageService.getMockViewUrl(ownerDbId, doc.key);
      } catch {
        url = `https://placehold.co/600x400?text=Unavailable`;
      }
    }

    return { ...doc, id: idVal, url };
  }),

  getUserImages: requireAuth(async (_, __, ctx) => {
    const ownerDbId = ctx.dbUser._id.toString();
    const images = await imageService.getImagesByUser(ownerDbId);

    return Promise.all(images.map(async (img) => {
      const doc = typeof img.toObject === 'function' ? img.toObject() : img;
      const idVal = doc._id ? doc._id.toString() : doc.id;

      // Try building a view URL using the Clerk userId first; if the key namespace
      // was generated with a different owner id (e.g., MongoDB _id), fall back
      // to using the ownerDbId so ownership checks succeed.
      let url;
      try {
        url = await imageService.getMockViewUrl(ctx.userId, doc.key);
      } catch (err) {
        try {
          url = await imageService.getMockViewUrl(ownerDbId, doc.key);
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
  })
};

export default { Query, Mutation };
