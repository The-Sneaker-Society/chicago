import Image from '../models/Image.model.js';

export const imageRepository = {
  async saveImagePointer(userId, key, filename, fileType) {
    return await Image.create({ userId, key, filename, fileType });
  },

  async getImagesByUser(userId) {
    return await Image.find({ userId }).sort({ createdAt: -1 });
  },

  async getImageById(id) {
    return await Image.findById(id);
  },

  async updateImageById(id, updates = {}) {
    return await Image.findByIdAndUpdate(id, updates, { new: true });
  },

  async deleteImageById(id) {
    return await Image.findByIdAndDelete(id);
  }
};
