// const path = require('path');
// const fs = require('fs').promises;
// const { v4: uuidv4 } = require('uuid');

// const BASE_IMAGE_URL = process.env.BASE_IMAGE_URL || 'http://localhost:5000/uploads';

// const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
// const maxSizeBytes = 5 * 1024 * 1024; // 5MB

// const uploadFilesToLocal = async (files, subfolder = 'farmhouseimages', oldUrls = []) => {
//   if (!files || files.length === 0) {
//     console.warn("⚠️ No files provided for local upload.");
//     return [];
//   }

//   const uploadDir = path.join(__dirname, '..', 'uploads', subfolder);
//   await fs.mkdir(uploadDir, { recursive: true });

//   // ✅ Delete Old Files
//   for (const oldUrl of oldUrls) {
//     const filename = oldUrl.split('/').pop(); // get only file name
//     const filePath = path.join(uploadDir, filename);

//     try {
//       await fs.unlink(filePath);
//       console.log(`🗑️ Deleted old image: ${filename}`);
//     } catch (err) {
//       console.warn(`⚠️ Failed to delete old image: ${filename}`);
//     }
//   }

//   const uploadedUrls = [];

//   for (const file of files) {
//     if (!file) continue;

//     const { mimetype, size, name, mv } = file;

//     if (!allowedTypes.includes(mimetype)) {
//       throw new Error(`❌ Invalid file type: ${name}. Only jpg, jpeg, png allowed.`);
//     }

//     if (size > maxSizeBytes) {
//       throw new Error(`❌ File too large: ${name}. Max 5MB allowed.`);
//     }

//     const extension = path.extname(name);
//     const uniqueName = `${uuidv4()}${extension}`;
//     const finalPath = path.join(uploadDir, uniqueName);

//     await mv(finalPath);

//     uploadedUrls.push(`${BASE_IMAGE_URL}/${subfolder}/${uniqueName}`);
//   }

//   return uploadedUrls;
// };

// module.exports = { uploadFilesToLocal };



const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const BASE_IMAGE_URL = process.env.BASE_IMAGE_URL;
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
const maxSizeBytes = 5 * 1024 * 1024; // 5MB

const uploadFilesToLocal = async (files, subfolder = 'farmhouseimages', oldUrls = []) => {
  if (!files || files.length === 0) {
    console.warn("⚠️ No files provided for local upload.");
    return [];
  }

  const uploadDir = path.join(__dirname, '..', 'uploads', subfolder);
  await fs.mkdir(uploadDir, { recursive: true });

  // Delete old files
  for (const oldUrl of oldUrls) {
    const filename = oldUrl.split('/').pop(); // get only file name
    const filePath = path.join(uploadDir, filename);
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted old image: ${filename}`);
    } catch (err) {
      console.warn(`⚠️ Failed to delete old image: ${filename}`);
    }
  }

  const uploadedUrls = [];

  for (const file of files) {
    if (!file) continue;

    let uniqueName, finalPath, buffer;

    // Check if it's a Base64 string
    if (typeof file === 'string' && file.startsWith('data:image/')) {
      const matches = file.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches) throw new Error('❌ Invalid base64 image format');

      const mimetype = matches[1];
      if (!allowedTypes.includes(mimetype)) throw new Error(`❌ Invalid file type: ${mimetype}. Only jpg, jpeg, png allowed.`);

      buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > maxSizeBytes) throw new Error(`❌ Base64 image too large. Max 5MB allowed.`);

      const extension = mimetype.split('/')[1];
      uniqueName = `${uuidv4()}.${extension}`;
      finalPath = path.join(uploadDir, uniqueName);

      await fs.writeFile(finalPath, buffer);
    } else {
      // Multipart/form-data file (old logic)
      const { mimetype, size, name, mv } = file;

      if (!allowedTypes.includes(mimetype)) throw new Error(`❌ Invalid file type: ${name}. Only jpg, jpeg, png allowed.`);
      if (size > maxSizeBytes) throw new Error(`❌ File too large: ${name}. Max 5MB allowed.`);

      const extension = path.extname(name);
      uniqueName = `${uuidv4()}${extension}`;
      finalPath = path.join(uploadDir, uniqueName);

      await mv(finalPath);
    }

    uploadedUrls.push(`${BASE_IMAGE_URL}/${subfolder}/${uniqueName}`);
  }

  return uploadedUrls;
};

module.exports = { uploadFilesToLocal };
