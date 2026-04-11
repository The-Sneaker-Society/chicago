import { imageRepository } from './image.repository.js';

export const imageService = {
  /**
   * Mocks S3/R2 Presigned Upload URL.
   * Uses JSONPlaceholder to simulate a successful 200 OK file PUT.
   */
  async getMockUploadTicket(userId, filename) {
    const uploadUrl = "https://jsonplaceholder.typicode.com/posts/1";
    // Key format: mock-uploads/{userId}/{filename}-{timestamp}-mock
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const key = `mock-uploads/${userId}/${safeFilename}-${timestamp}-mock`;
    return { uploadUrl, key };
  },

  /**
   * Mocks S3/R2 Signed View URL.
   * Checks ownership before returning a renderable placeholder.
   */
  async getMockViewUrl(userId, key) {
    if (!key.startsWith(`mock-uploads/${userId}/`)) {
      throw new Error("Unauthorized: Access Denied to resource.");
    }

    return `https://placehold.co/600x400?text=Mock+Image+User+${userId}`;
  },


  // Repository-backed helpers (service layer)
  async saveImagePointer(userId, key, filename, fileType) {
    return await imageRepository.saveImagePointer(userId, key, filename, fileType);
  },

  async getImagesByUser(userId) {
    return await imageRepository.getImagesByUser(userId);
  },

  async getImageById(id) {
    return await imageRepository.getImageById(id);
  },

  async updateImageById(id, updates) {
    return await imageRepository.updateImageById(id, updates);
  },

  async deleteImageById(id) {
    return await imageRepository.deleteImageById(id);
  }
};
