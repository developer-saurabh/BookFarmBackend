const axios = require("axios");
const oneSignalConfig = require("../config/oneSignal");

async function sendNotification({ playerIds, title, message, data = {} }) {
  try {
    if (!playerIds || playerIds.length === 0) {
      console.warn("⚠️ No playerIds provided, skipping notification.");
      return;
    }

    // ✅ Filter only valid OneSignal player IDs (UUID format, 36 chars)
    const validPlayerIds = playerIds.filter(
      id => typeof id === "string" && id.length === 36
    );

    if (validPlayerIds.length === 0) {
      console.warn("⚠️ No valid OneSignal playerIds to send notification.");
      return;
    }

    console.log("Sending notification to:", validPlayerIds);

    const response = await axios.post(
      `${oneSignalConfig.baseURL}/notifications`,
      {
        app_id: oneSignalConfig.appId,
        include_player_ids: validPlayerIds, 
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

    console.log("Notification sent successfully:", response.data);
    return response.data;
  } catch (err) {
    console.error(
      "🚨 Error sending notification:", 
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = { sendNotification };
