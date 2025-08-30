
const axios = require("axios");
const oneSignalConfig = require("../config/oneSignal");
async function sendNotification({ playerIds, title, message, data = {} }) {
  try {
    if (!playerIds || playerIds.length === 0) {
      console.warn("⚠️ No playerIds provided, skipping notification.");
      return;
    }

    const response = await axios.post(
      `${oneSignalConfig.baseURL}/notifications`,
      {
        app_id: oneSignalConfig.appId,
        include_player_ids: playerIds, // supports multiple devices
        headings: { en: title },
        contents: { en: message },
        data,
      },
      {
        headers: {
          Authorization: `Basic ${oneSignalConfig.restApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: oneSignalConfig.timeoutMs,
      }
    );

    return response.data;
  } catch (err) {
    console.error("🚨 Error sending notification:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendNotification };