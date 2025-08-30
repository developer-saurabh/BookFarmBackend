// services/oneSignalService.js
const axios = require("axios");
const { appId, apiKey, baseURL } = require("../config/oneSignal");

// Send push notification to specific device(s)
async function sendPushNotification({ title, message, playerIds = [] }) {
  try {
    const response = await axios.post(
      `${baseURL}/api/v1/notifications`,
      {
        app_id: appId,
        headings: { en: title },
        contents: { en: message },
        include_player_ids: playerIds, // device tokens
      },
      {
        headers: {
          Authorization: `Basic ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error("❌ Error sending notification:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  sendPushNotification,
};
