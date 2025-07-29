const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const fs = require('fs').promises;
const { createCanvas } = require('canvas');

// ✅ Define this at the very top so it's always available
const loadJimpESM = async () => {
  return await import('jimp'); // dynamically import Jimp ESM
};

const adminSchema = new mongoose.Schema({
  // ✅ Auth details
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
phone: {
    type: String,
    required: true
  },
   address: { type: String, required: true, trim: true },

  // ✅ Admin status
  isSuperAdmin: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image_url:{
    type:String,
    default:null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  lastLogin: { type: Date, default: null }

}, { timestamps: true });



adminSchema.pre('save', async function (next) {
  try {
    if (!this.image_url) {
      const initials = this.name
        .split(' ')
        .map(n => n[0].toUpperCase())
        .join('');

      const fileName = `${initials}_${uuidv4()}.png`;
      const tempDir = path.join(__dirname, '../temp');
      const tempFilePath = path.join(tempDir, fileName);
      await fs.mkdir(tempDir, { recursive: true });

      // ✅ Generate avatar with node-canvas
      const size = 200;
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#3498db';
      ctx.fillRect(0, 0, size, size);

      // Text (Initials)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 80px Sans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, size / 2, size / 2);

      // Save PNG
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(tempFilePath, buffer);

      // ✅ Upload to Cloudinary
      const fakeFile = {
        tempFilePath,
        mimetype: 'image/png',
        size: buffer.length,
        name: fileName
      };

      const urls = await uploadFilesToCloudinary([fakeFile], 'admin_avatars');
      this.image_url = urls[0];

      // // ✅ Cleanup
      // await fs.unlink(tempFilePath);
    }
    next();
  } catch (err) {
    console.error('🔥 Avatar generation failed:', err);
    next(err);
  }
});

module.exports = mongoose.model('Admin', adminSchema);
