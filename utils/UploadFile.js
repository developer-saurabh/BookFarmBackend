const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadFiles = async (files, subfolder, maxSizeMB = 8) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Make sure ./Media/subfolder exists
  const uploadDir = path.join(__dirname, '../Media', subfolder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const uploadedPaths = [];

  for (const file of files) {
    // ✅ Validate MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.name}. Only jpg, jpeg, png are allowed.`);
    }

    // ✅ Validate size
    if (file.size > maxSizeBytes) {
      throw new Error(`File too large: ${file.name}. Max ${maxSizeMB} MB allowed.`);
    }

    // ✅ Unique file name
    const ext = path.extname(file.name);
    const uniqueName = `${uuidv4()}${ext}`;
    const fullPath = path.join(uploadDir, uniqueName);

    // ✅ Move the file to Media
    await file.mv(fullPath);

    // ✅ Store relative path for DB
    const relativePath = path.join('Media', subfolder, uniqueName);
    uploadedPaths.push(relativePath);
  }

  return uploadedPaths;
};

module.exports = {uploadFiles};
