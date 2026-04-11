import mongoose from 'mongoose';

const ImageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    key: { type: String, required: true }, // The logical path (e.g., users/id/file.jpg)
    filename: { type: String },
    fileType: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: 'images',
    timestamps: true,
  }
);

const Image = mongoose.models.Image || mongoose.model('Image', ImageSchema, 'images');

export default Image;
