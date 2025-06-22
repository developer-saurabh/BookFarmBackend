const botService = require("../services/botServcice");
const whatsappService = require("../services/whatsappService");

exports.receiveMessage = async (req, res) => {
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

      // ✅ Get reply from botService
      const reply = await botService.handleMessage(`whatsapp:${from}`, body);
      console.log("reply printing", reply);

      // ✅ If venues to show -> follow sequential format
      if (reply.venuesToShow?.length) {
        for (let i = 0; i < reply.venuesToShow.length; i++) {
          const venue = reply.venuesToShow[i];

          // 📌 1️⃣ Compose nicely formatted block
          let block = `${i + 1}) *${venue.name}*\n`;
          block += `🏷️ Category: ${venue.category}\n`;
          block += `📍 Location: ${venue.location?.city}, ${venue.location?.state}\n`;
          block += `👥 Capacity: ${venue.capacity || 'N/A'}\n`;
          block += `💰 Full Day: ₹${venue.pricing?.fullDay || 'N/A'}\n`;
          block += `💰 Day Slot: ₹${venue.pricing?.daySlot || 'N/A'}\n`;
          block += `💰 Night Slot: ₹${venue.pricing?.nightSlot || 'N/A'}`;

          // ✅ 2️⃣ Send this block
          await whatsappService.sendMessage(`whatsapp:${from}`, block);

          // ✅ 3️⃣ Send all images of this venue
          if (venue.images?.length) {
            for (const img of venue.images) {
              if (img.startsWith('http')) {
                await whatsappService.sendImage(`whatsapp:${from}`, img, venue.name);
              }
            }
          }
        }

        // ✅ 4️⃣ Send final prompt ONCE after all
        await whatsappService.sendMessage(
          `whatsapp:${from}`,
          `👉 *Reply with the number* to choose, or 0 to go back.`
        );

      } else {
        // ✅ If not a venue listing, just reply normally
        await whatsappService.sendMessage(`whatsapp:${from}`, reply.text);
      }

      return res.sendStatus(200);

    } catch (err) {
      console.error('❌ Error in receiveMessage:', err);
      return res.sendStatus(500);
    }
  }
};
