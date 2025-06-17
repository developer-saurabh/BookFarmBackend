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

  let response = '';
  const lowerMsg = message.trim().toLowerCase();

  // Entry point
  if (lowerMsg === 'hi' || user.currentState === 'new') {
    response = `👋 Hey there! Welcome to *Venue & Farm Booking Bot*.

Reply with:
1️⃣ Book a Venue
2️⃣ Book a Farm
3️⃣ Cancel a Booking
4️⃣ Check Availability
5️⃣ Help`;

    user.currentState = 'awaiting_option';
    await user.save();
    return response;
  }

  // Handle main options
  if (user.currentState === 'awaiting_option') {
    switch (lowerMsg) {
      case '1':
        user.currentState = 'choosing_venue_type';
        await user.save();
        response = `🏛️ Great! What type of venue do you want?
1️⃣ Wedding Hall
2️⃣ Banquet
3️⃣ Party Lawn
4️⃣ Conference Hall`;
        break;
      case '2':
        user.currentState = 'choosing_farm_type';
        await user.save();
        response = `🌿 Nice! What type of farm do you want?
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
        response = `🔍 Please type *venue* or *farm* to check availability.`;
        break;
      case '5':
        response = `🤝 I can help you:
- Book a venue/farm
- Cancel bookings
- Check availability

Type "hi" anytime to restart.`;
        break;
      default:
        response = `❗️ Invalid option. Reply with 1, 2, 3, 4, or 5.`;
    }
    return response;
  }

  // Choosing venue type
  if (user.currentState === 'choosing_venue_type') {
    let type;
    switch (lowerMsg) {
      case '1': type = 'Wedding Hall'; break;
      case '2': type = 'Banquet'; break;
      case '3': type = 'Party Lawn'; break;
      case '4': type = 'Conference Hall'; break;
      default: type = null;
    }

    if (!type) {
      return `❗️ Invalid choice. Please pick 1, 2, 3, or 4 for venue type.`;
    }

    // Save choice temporarily
    user.metaData = { venueType: type };
    user.currentState = 'booking_venue';
    await user.save();

    // Fetch matching venues (mock: filter by type)
    const venues = await Venue.find({ name: new RegExp(type, 'i') }).limit(5);

    if (!venues.length) {
      return `😔 Sorry, no ${type}s found right now. Try another type!`;
    }

    // Build response with names (images will be sent via WhatsApp API call)
    response = `🎉 Here are some ${type}s:\n`;
    venues.forEach((v, i) => {
      response += `${i + 1}) ${v.name}\n`;
    });
    response += `\nReply with the number to choose one.`;

    // (Optional) You can store venue list in metaData too:
    user.metaData.venueList = venues.map(v => v._id);
    await user.save();

    return response;
  }

  // Finalize venue booking: choose from venue list
  if (user.currentState === 'booking_venue') {
    const idx = parseInt(lowerMsg) - 1;
    const venueIds = user.metaData?.venueList || [];

    if (isNaN(idx) || idx < 0 || idx >= venueIds.length) {
      return `❗️ Invalid choice. Please pick a valid number from the list.`;
    }

    const chosenVenueId = venueIds[idx];
    user.metaData.chosenVenueId = chosenVenueId;
    user.currentState = 'booking_venue_date';
    await user.save();

    return `📅 Great! Please enter your booking date (YYYY-MM-DD):`;
  }

  // Get date and confirm venue booking
  if (user.currentState === 'booking_venue_date') {
    const dateInput = lowerMsg;
    const chosenVenueId = user.metaData?.chosenVenueId;

    if (!chosenVenueId) {
      user.currentState = 'awaiting_option';
      await user.save();
      return `❗️ Something went wrong. Please type "hi" to start over.`;
    }

    // TODO: Validate date
    const booking = new Booking({
      user: user._id,
      type: 'Venue',
      item: chosenVenueId,
      date: new Date(dateInput),
      status: 'Pending'
    });
    await booking.save();

    user.currentState = 'done';
    user.metaData = {};
    await user.save();

    return `✅ Booking received for ${dateInput}! We’ll confirm soon. Type "hi" for more.`;
  }

  // Similar flow for Farm Booking:
  if (user.currentState === 'choosing_farm_type') {
    let type;
    switch (lowerMsg) {
      case '1': type = 'Mango Farm'; break;
      case '2': type = 'Organic Farm'; break;
      case '3': type = 'Event Farm'; break;
      default: type = null;
    }

    if (!type) {
      return `❗️ Invalid choice. Please pick 1, 2, or 3 for farm type.`;
    }

    user.metaData = { farmType: type };
    user.currentState = 'booking_farm';
    await user.save();

    const farms = await Farm.find({ name: new RegExp(type, 'i') }).limit(5);

    if (!farms.length) {
      return `😔 Sorry, no ${type}s found. Try another type!`;
    }

    response = `🌾 Here are some ${type}s:\n`;
    farms.forEach((f, i) => {
      response += `${i + 1}) ${f.name}\n`;
    });
    response += `\nReply with the number to choose one.`;

    user.metaData.farmList = farms.map(f => f._id);
    await user.save();

    return response;
  }

  if (user.currentState === 'booking_farm') {
    const idx = parseInt(lowerMsg) - 1;
    const farmIds = user.metaData?.farmList || [];

    if (isNaN(idx) || idx < 0 || idx >= farmIds.length) {
      return `❗️ Invalid choice. Please pick a valid number from the list.`;
    }

    const chosenFarmId = farmIds[idx];
    user.metaData.chosenFarmId = chosenFarmId;
    user.currentState = 'booking_farm_date';
    await user.save();

    return `📅 Great! Please enter your booking date (YYYY-MM-DD):`;
  }

  if (user.currentState === 'booking_farm_date') {
    const dateInput = lowerMsg;
    const chosenFarmId = user.metaData?.chosenFarmId;

    if (!chosenFarmId) {
      user.currentState = 'awaiting_option';
      await user.save();
      return `❗️ Something went wrong. Please type "hi" to start over.`;
    }

    const booking = new Booking({
      user: user._id,
      type: 'Farm',
      item: chosenFarmId,
      date: new Date(dateInput),
      status: 'Pending'
    });
    await booking.save();

    user.currentState = 'done';
    user.metaData = {};
    await user.save();

    return `✅ Booking received for ${dateInput}! We’ll confirm soon. Type "hi" for more.`;
  }

  // Fallback
  return `🤖 Sorry, I didn't get that. Type "hi" to see the menu again.`;
};

module.exports = botService;
