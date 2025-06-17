const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;

const client = twilio(accountSid, authToken);

const whatsappService = {};

whatsappService.sendMessage = async (to, message) => {
  console.log(`💬 Sending to ${to}: ${message}`);

  // ✅ Twilio requires 'whatsapp:' prefix
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await client.messages.create({
    body: message,
    from,
    to: formattedTo,
  });

  console.log(`✅ Message sent via Twilio`);
};

module.exports = whatsappService;
