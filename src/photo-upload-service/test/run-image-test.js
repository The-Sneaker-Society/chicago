import { imageService } from '../image.service.js';
import { imageRepository } from '../image.repository.js';
import imageResolvers from '../image.resolvers.js';

async function run() {
  console.log('=== Testing imageService.getMockUploadTicket ===');
  const ticket = await imageService.getMockUploadTicket('test-user', 'photo.jpg');
  console.log('upload ticket:', ticket);

  console.log('\n=== Testing imageService.getMockViewUrl ===');
  const viewUrl = await imageService.getMockViewUrl('test-user', ticket.key);
  console.log('view url:', viewUrl);

  // Monkeypatch repository methods to avoid DB access
  imageRepository.saveImagePointer = async (userId, key, filename, fileType) => {
    return {
      id: 'mock-id-1',
      userId,
      key,
      filename,
      fileType,
      createdAt: new Date().toISOString(),
    };
  };

  imageRepository.getImagesByUser = async (userId) => {
    return [
      {
        _id: 'mock-id-1',
        userId,
        key: ticket.key,
        filename: 'photo.jpg',
        fileType: 'image/jpeg',
        createdAt: new Date().toISOString(),
        toObject() { return this; }
      }
    ];
  };

  console.log('\n=== Testing confirmImageUpload resolver ===');
  const confirmRes = await imageResolvers.Mutation.confirmImageUpload(null, { key: ticket.key, filename: 'photo.jpg', fileType: 'image/jpeg' }, { auth: { userId: 'test-user' } });
  console.log('confirm result:', confirmRes);

  console.log('\n=== Testing getUserImages resolver ===');
  const imgs = await imageResolvers.Query.getUserImages(null, null, { auth: { userId: 'test-user' } });
  console.log('images:', imgs);

  console.log('\n=== Testing updateImage resolver ===');
  // Monkeypatch getImageById and update/delete functions for this test
  imageRepository.getImageById = async (id) => ({ _id: id, userId: 'test-user', key: ticket.key, filename: 'photo.jpg', fileType: 'image/jpeg', createdAt: new Date().toISOString(), toObject() { return this; } });
  imageRepository.updateImageById = async (id, updates) => ({ _id: id, userId: 'test-user', key: ticket.key, filename: updates.filename || 'photo.jpg', fileType: updates.fileType || 'image/jpeg', createdAt: new Date().toISOString(), toObject() { return this; } });
  imageRepository.deleteImageById = async (id) => ({ _id: id });

  const updated = await imageResolvers.Mutation.updateImage(null, { id: 'mock-id-1', filename: 'new.jpg', fileType: 'image/png' }, { auth: { userId: 'test-user' } });
  console.log('updated:', updated);

  console.log('\n=== Testing deleteImage resolver ===');
  const del = await imageResolvers.Mutation.deleteImage(null, { id: 'mock-id-1' }, { auth: { userId: 'test-user' } });
  console.log('deleted:', del);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
