const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// 🔑 Create Cloudinary storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'venues',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});

// ✅ Multer instance for multiple images
const upload = multer({ storage: storage });

module.exports = upload;
