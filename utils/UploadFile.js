const cloudinary = require('../config/cloudinary');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises; // use promises version
const path = require('path');

const uploadFilesToCloudinary = async (files, subfolder) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSizeBytes = 5 * 1024 * 1024; // 8MB

  const uploadedUrls = [];

  for (const file of files) {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalidd file type: ${file.name}. Only jpg, jpeg, png allowed.`);
    }

    if (file.size > maxSizeBytes) {
      throw new Error(`File too large: ${file.name}. Max 8MB allowed.`);
    }
          console.log("file temp path printing",file.tempFilePath)
    const uploadResult = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: `BookMyFarmAndVenue/${subfolder}`,
      public_id: uuidv4(),
      resource_type: 'image'
    });
console.log(
  "file uploaded to cloudinary successfully "
)
    uploadedUrls.push(uploadResult.secure_url);

    // ✅ CLEANUP: delete temp file
    await fs.unlink(file.tempFilePath);
  }

  return uploadedUrls;
};

module.exports = { uploadFilesToCloudinary };
