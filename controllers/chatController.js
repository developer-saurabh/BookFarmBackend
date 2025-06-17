const botService = require('../services/botService');
const whatsappService = require('../services/whatsappService');

// Main webhook controller
exports.receiveMessage = async (req, res) => {
  try {
    // For Twilio: message comes in `Body` and `From`
    // For other APIs: adjust accordingly
    const incomingMsg = req.body.Body || req.body.message || '';
    const from = req.body.From || req.body.phone || '';

    console.log(`👉 Incoming from ${from}: ${incomingMsg}`);

    // Let botService handle the logic & get response text
    const replyText = await botService.handleMessage(from, incomingMsg);

    // Send it back via your WhatsApp API
    await whatsappService.sendMessage(from, replyText);

    // Respond to webhook (Twilio expects 200 OK with no extra text)
    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error in receiveMessage:', error);
    res.status(500).send('Server Error');
  }
};
