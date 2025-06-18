const User = require('../models/User');
const Venue = require('../models/Venue');
const Farm = require('../models/Farm');
const Booking = require('../models/Booking');

const botService = {};

botService.handleMessage = async (phone, message) => {
  let user = await User.findOne({ phone });
  if (!user) {
    user = new User({ phone, currentState: 'new' });
    await user.save();
  }

  const ERRORS = {
    INVALID_OPTION: "❗️ Invalid option. Please pick a valid number from the list.",
    NO_RESULTS: (type) => `😔 Sorry, no ${type}s found right now. Please reply 0 to go back.`,
  };

  let response = '';
  const lowerMsg = message.trim().toLowerCase();

  // 1️⃣ Greeting & main menu
  if (lowerMsg === 'hi' || user.currentState === 'new') {
    response = `👋 Hey there! Welcome to *Venue & Farm Booking Bot*.

Reply with:
1️⃣ Book a Venue
2️⃣ Book a Farm
3️⃣ Cancel a Booking
4️⃣ Check Availability
5️⃣ Help`;

    user.currentState = 'awaiting_option';
    user.metaData = {};
    await user.save();
    return { text: response };
  }

  // 2️⃣ Main options
  if (user.currentState === 'awaiting_option') {
    switch (lowerMsg) {
      case '1':
        user.currentState = 'choosing_venue_type';
        user.metaData = {};
        await user.save();
        response = `🏛️ What type of venue would you like?
1️⃣ Wedding Hall
2️⃣ Banquet
3️⃣ Party Lawn
4️⃣ Conference Hall`;
        break;
      case '2':
        user.currentState = 'choosing_farm_type';
        user.metaData = {};
        await user.save();
        response = `🌿 What type of farm would you like?
1️⃣ Mango Farm
2️⃣ Organic Farm
3️⃣ Event Farm`;
        break;
      case '3':
        user.currentState = 'cancelling';
        await user.save();
        response = `❌ Please provide your booking ID to cancel:`;
        break;
      case '4':
        user.currentState = 'checking_availability';
        await user.save();
        response = `🔍 Do you want to check *venue* or *farm* availability?`;
        break;
      case '5':
        response = `🤝 I can help you:
- Book a venue/farm
- Cancel bookings
- Check availability

Type "hi" anytime to restart.`;
        break;
      default:
        response = ERRORS.INVALID_OPTION;
    }
    return { text: response };
  }

  // 3️⃣ Venue type selector
  if (user.currentState === 'choosing_venue_type') {
    const typeMap = {
      '1': 'Wedding Hall',
      '2': 'Banquet',
      '3': 'Party Lawn',
      '4': 'Conference Hall',
      '0': 'back'
    };

    const type = typeMap[lowerMsg];
    if (!type) return { text: ERRORS.INVALID_OPTION };

    if (type === 'back') {
      user.currentState = 'awaiting_option';
      user.metaData = {};
      await user.save();
      return { text: `🔙 Back to main menu. Type "hi" to see options again.` };
    }

    const venues = await Venue.find({ type: type }).limit(5);

    if (!venues.length) {
      return { text: ERRORS.NO_RESULTS(type) };
    }

    let responseText = `🎉 Here are some ${type}s:\n`;
    venues.forEach((v, i) => {
      responseText += `${i + 1}) ${v.name}\n`;
    });
    responseText += `\nReply with the number to choose one, or 0 to go back.`;

    user.metaData = {
      venueType: type,
      venueList: venues.map(v => v._id)
    };
    user.currentState = 'booking_venue';
    await user.save();

    return { text: responseText, venuesToShow: venues };
  }

  // 4️⃣ Venue selector
  if (user.currentState === 'booking_venue') {
    if (lowerMsg === '0') {
      user.currentState = 'choosing_venue_type';
      await user.save();
      return { text: `🔙 Back to venue types. Please pick again.` };
    }

    const idx = parseInt(lowerMsg) - 1;
    const venueIds = user.metaData?.venueList || [];

    if (isNaN(idx) || idx < 0 || idx >= venueIds.length) {
      return { text: ERRORS.INVALID_OPTION };
    }

    const chosenVenueId = venueIds[idx];
    user.metaData.chosenVenueId = chosenVenueId;
    user.currentState = 'booking_venue_date';
    await user.save();

    return { text: `📅 Great! Please enter your booking date (YYYY-MM-DD):` };
  }

  // 5️⃣ Date entry for venue
  if (user.currentState === 'booking_venue_date') {
    const chosenVenueId = user.metaData?.chosenVenueId;
    console.log("chosenVenueId",chosenVeneuId)

    if (!chosenVenueId) {
      user.currentState = 'awaiting_option';
      user.metaData = {};
      await user.save();
      return { text: `❗️ Something went wrong. Please type "hi" to start again.` };
    }

    // ✅ Validate date
    const inputDate = new Date(lowerMsg);
    if (isNaN(inputDate.getTime())) {
      return { text: `❗️ Invalid date format. Please enter date as YYYY-MM-DD.` };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (inputDate < today) {
      return { text: `❗️ Date cannot be in the past. Please pick a valid future date (YYYY-MM-DD).` };
    }

    const booking = new Booking({
      user: user._id,
      type: 'Venue',
      item: chosenVenueId,
      date: inputDate,
      status: 'Pending'
    });
    await booking.save();

    user.currentState = 'done';
    user.metaData = {};
    await user.save();

    return { text: `✅ Booking received for ${lowerMsg}! We’ll confirm soon. Type "hi" for more.` };
  }

  // 6️⃣ Fallback
  return { text: `🤖 Sorry, I didn't get that. Type "hi" to start over.` };
};

module.exports = botService;
