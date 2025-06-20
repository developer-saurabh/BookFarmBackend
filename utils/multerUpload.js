const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// ✅ Smart storage generator
const getUpload = (subfolder) => {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `mediauploads/${subfolder}`,
      allowed_formats: ['jpg', 'jpeg', 'png'],
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only images allowed!'), false);
    },
  });
};

module.exports = getUpload;
