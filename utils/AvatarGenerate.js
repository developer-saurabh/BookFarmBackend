const path = require('path');
const fs = require('fs').promises;
const { createCanvas } = require('canvas');
const { v4: uuidv4 } = require('uuid');
const { uploadFilesToLocal } = require('./UploadFileToLocal');
// const { uploadFilesToCloudinary } = require('./UploadFile'); // ❌ Commented Cloudinary


async function generateAvatarAndUpload(name, folderName) {
  const initials = name.split(' ').map(n => n[0].toUpperCase()).join('');
  const fileName = `${initials}_${uuidv4()}.png`;
  const tempDir = path.join(__dirname, '../temp');
  const tempFilePath = path.join(tempDir, fileName);
  await fs.mkdir(tempDir, { recursive: true });

  // 🎨 Draw Avatar
  const size = 200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3498db';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 80px Sans';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2);

  // 💾 Save to temp path
  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(tempFilePath, buffer);

  const fakeFile = {
    tempFilePath,
    mimetype: 'image/png',
    size: buffer.length,
    name: fileName,
    mv: async (destPath) => {
      await fs.rename(tempFilePath, destPath); // 🔄 mimic express-fileupload `mv`
    }
  };

  // ✅ Upload to Local (new logic)
  const urls = await uploadFilesToLocal([fakeFile], folderName);

  // ❌ Old Cloudinary Upload (Commented)
  // const urls = await uploadFilesToCloudinary([fakeFile], folderName);

  return urls[0]; // ✅ Return the local image URL
}

module.exports = { generateAvatarAndUpload };
