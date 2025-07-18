module.exports = {
  // 🔑 MAIN MENUS
  GREETING: `👋 Hey there! Welcome to *Venue & Farm Booking Bot*.

Reply with:
1️⃣ Book a Venue
2️⃣ Book a Farm
3️⃣ Cancel a Booking
4️⃣ Check Availability
5️⃣ Help`,

  HELP: `🤝 I can help you:
- Book a venue/farm
- Cancel bookings
- Check availability

Type "hi" anytime to restart.`,

  // 🔑 GENERAL
  INVALID_OPTION: `❗️ Invalid option. Please pick a valid number from the list.`,

  NO_RESULTS: (type) => `😔 Sorry, no ${type}s found right now. Please reply 0 to go back.`,

  BACK_TO_MENU: `🔙 Back to main menu. Type "hi" to start over.`,

  DATE_PROMPT: `📅 Great! Please enter your booking date (YYYY-MM-DD):`,

  INVALID_DATE: `❗️ Invalid date format. Please enter date as YYYY-MM-DD.`,

  PAST_DATE: `❗️ Date cannot be in the past. Please pick a valid future date (YYYY-MM-DD).`
};
