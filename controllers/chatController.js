const botService = require("../services/botServcice")
const whatsappService = require("../services/whatsappService")
// ✅ Meta webhook: handshake + receive messages
exports.receiveMessage = async (req, res) => {
  // ✅ 1) Verification handshake
  if (req.method === 'GET') {
    const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ WEBHOOK VERIFIED!');
        return res.status(200).send(challenge);
      } else {
        return res.sendStatus(403);
      }
    }
  }

  // ✅ 2) Handle incoming messages (POST)
  if (req.method === 'POST') {
    try {
      console.log(JSON.stringify(req.body, null, 2));

      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) return res.sendStatus(200);

      const from = message.from;
      const body = message.text?.body || '';

      console.log(`👉 Incoming from ${from}: ${body}`);

      const reply = await botService.handleMessage(`whatsapp:${from}`, body);

      await whatsappService.sendMessage(`whatsapp:${from}`, reply.text);

      if (reply.venuesToShow) {
        for (const venue of reply.venuesToShow) {
          if (venue.images?.length) {
            for (const img of venue.images) {
              await whatsappService.sendImage(`whatsapp:${from}`, img, venue.name);
            }
          }
        }
      }

      res.sendStatus(200);

    } catch (err) {
      console.error('❌ Error in receiveMessage:', err);
      res.sendStatus(500);
    }
  }
};
