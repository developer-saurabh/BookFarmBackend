const twilio = require('twilio');
require("dotenv").config();

console.log("SID:", process.env.TWILIO_ACCOUNT_SID);
console.log("TOKEN:", process.env.TWILIO_AUTH_TOKEN);
console.log("FROM:", process.env.TWILIO_WHATSAPP_FROM);

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;

const client = twilio(accountSid, authToken);

const whatsappService = {};

// ✅ Send plain text
whatsappService.sendMessage = async (to, message) => {
  console.log(`💬 Sending to ${to}: ${message}`);
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await client.messages.create({
    body: message,
    from,
    to: formattedTo,
  });

  console.log(`✅ Text message sent via Twilio`);
};

// ✅ Send image
whatsappService.sendImage = async (to, imageUrl, caption = '') => {
  console.log(`🖼️ Sending image to ${to}: ${imageUrl} (caption: ${caption})`);
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await client.messages.create({
    from,
    to: formattedTo,
    mediaUrl: [imageUrl],
    body: caption || '', // Optional: Twilio supports image with text caption
  });

  console.log(`✅ Image sent via Twilio`);
};

module.exports = whatsappService;
