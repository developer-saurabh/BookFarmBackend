const axios = require('axios');


const whatsappService = {};

const META_URL = `https://graph.facebook.com/${process.env.META_WA_API_VERSION}/${process.env.META_WA_PHONE_NUMBER_ID}/messages`;

const headers = {
  'Authorization': `Bearer ${process.env.META_WA_ACCESS_TOKEN}`,
  'Content-Type': 'application/json'
};

whatsappService.sendMessage = async (to, message) => {
  console.log(`💬 Sending to ${to}: ${message}`);
  
  const payload = {
    messaging_product: "whatsapp",
    to: to.replace("whatsapp:", ""), // Meta wants number only
    type: "text",
    text: { body: message }
  };

  const response = await axios.post(META_URL, payload, { headers });
  console.log(`✅ Meta Text Sent:`, response.data);
};

whatsappService.sendImage = async (to, imageUrl, caption = "") => {
  console.log(`🖼️ Sending image to ${to}: ${imageUrl}`);
  
  const payload = {
    messaging_product: "whatsapp",
    to: to.replace("whatsapp:", ""),
    type: "image",
    image: {
      link: imageUrl,
      caption: caption
    }
  };

  const response = await axios.post(META_URL, payload, { headers });
  console.log(`✅ Meta Image Sent:`, response.data);
};

module.exports = whatsappService;
