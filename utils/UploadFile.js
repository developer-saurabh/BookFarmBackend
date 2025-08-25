const cloudinary = require('../config/cloudinary');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises; // use promises version
const path = require('path');




// const uploadFilesToCloudinary = async (files, subfolder) => {
//   const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
//   const maxSizeBytes = 5 * 1024 * 1024; // 8MB

//   const uploadedUrls = [];

//   for (const file of files) {
//     if (!allowedTypes.includes(file.mimetype)) {
//       throw new Error(`Invalidd file type: ${file.name}. Only jpg, jpeg, png allowed.`);
//     }

//     if (file.size > maxSizeBytes) {
//       throw new Error(`File too large: ${file.name}. Max 8MB allowed.`);
//     }
//           console.log("file temp path printing",file.tempFilePath)
//     const uploadResult = await cloudinary.uploader.upload(file.tempFilePath, {
//       folder: `BookMyFarmAndVenue/${subfolder}`,
//       public_id: uuidv4(),
//       resource_type: 'image'
//     });
// console.log(
//   "file uploaded to cloudinary successfully "
// )
//     uploadedUrls.push(uploadResult.secure_url);

//     // ✅ CLEANUP: delete temp file
//     await fs.unlink(file.tempFilePath);
//   }

//   return uploadedUrls;
// };

// const uploadFilesToCloudinary = async (files, subfolder) => {
//   if (!files || files.length === 0) {
//     console.warn("⚠️ No files provided for Cloudinary upload.");
//     return [];
//   }

//   const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
//   const maxSizeBytes = 5 * 1024 * 1024;
//   const uploadedUrls = [];

//   for (const file of files) {
//     if (!file) continue;
//     if (!file.mimetype) throw new Error("Invalid file object, missing mimetype");

//     if (!allowedTypes.includes(file.mimetype)) {
//       throw new Error(`Invalid file type: ${file.name || 'unknown'}. Only jpg, jpeg, png allowed.`);
//     }
//     if (file.size > maxSizeBytes) {
//       throw new Error(`File too large: ${file.name || 'unknown'}. Max 5MB allowed.`);
//     }

//     console.log("Uploading file to Cloudinary:", file.tempFilePath);

//     const uploadResult = await cloudinary.uploader.upload(file.tempFilePath, {
//       folder: `BookMyFarmAndVenue/${subfolder}`,
//       public_id: uuidv4(),
//       resource_type: 'image'
//     });

//     uploadedUrls.push(uploadResult.secure_url);

//     await fs.unlink(file.tempFilePath).catch(() => {});
//   }

//   return uploadedUrls;
// };

// === UPDATED UPLOAD UTILITY ===
const uploadFilesToCloudinary = async (files, subfolder) => {
  if (!files || files.length === 0) {
    console.warn("⚠️ No files provided for Cloudinary upload.");
    return [];
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const maxSizeBytes = 5 * 1024 * 1024;
  const uploadedUrls = [];

  for (const file of files) {
    if (!file) continue;

    let tempFilePath;
    let mimeType;
    let size;

    if (typeof file === "string" && file.startsWith("data:")) {
      // === Handle base64 string ===
      const matches = file.match(/^data:(.+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid base64 string");

      mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      size = buffer.length;

      tempFilePath = path.join(__dirname, "../tmp", `${uuidv4()}.${mimeType.split("/")[1]}`);
      await fs.mkdir(path.dirname(tempFilePath), { recursive: true });
      await fs.writeFile(tempFilePath, buffer);
    } else {
      // === Handle normal file object ===
      if (!file.mimetype) throw new Error("Invalid file object, missing mimetype");
      mimeType = file.mimetype;
      size = file.size;
      tempFilePath = file.tempFilePath;
    }

    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Invalid file type. Only jpg, jpeg, png allowed.`);
    }
    if (size > maxSizeBytes) {
      throw new Error(`File too large. Max 5MB allowed.`);
    }

    console.log("Uploading file to Cloudinary:", tempFilePath);

    const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
      folder: `BookMyFarmAndVenue/${subfolder}`,
      public_id: uuidv4(),
      resource_type: "image",
    });

    uploadedUrls.push(uploadResult.secure_url);

    // cleanup temp file if we created it
    if (typeof file === "string") {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  return uploadedUrls;
};

module.exports = { uploadFilesToCloudinary };
