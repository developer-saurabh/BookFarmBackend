const botService = require('../services/botServcice');
const whatsappService = require('../services/whatsappService');
exports.receiveMessage = async (req, res) => {
  try {
    const { From: from, Body: body } = req.body;

    console.log(`👉 Incoming from ${from}: ${body}`);

    // Run bot logic
    const reply = await botService.handleMessage(from, body);

    // ✅ 1️⃣ Send to WhatsApp (ONLY in real webhook)
    if (process.env.NODE_ENV !== 'test') {
      await whatsappService.sendMessage(from, reply.text);

      if (reply.venuesToShow) {
        for (const venue of reply.venuesToShow) {
          if (venue.images?.length) {
            for (const img of venue.images) {
              await whatsappService.sendImage(from, img, venue.name);
            }
          }
        }
      }
    }

    // ✅ 2️⃣ For Postman: return the bot reply JSON
    res.status(200).json({
      success: true,
      text: reply.text,
      venues: reply.venuesToShow || []
    });

  } catch (error) {
    console.error('❌ Error in receiveMessage:', error);
    res.status(500).send('Server Error');
  }
};
