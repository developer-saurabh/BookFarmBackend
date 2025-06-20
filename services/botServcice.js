const ChatSession = require('./models/ChatSession');
const Customer = require('./models/Customer');
const Venue = require('./models/Venue');
const Farm = require('./models/Farm');
const VenueBooking = require('./models/VenueBooking');
const FarmBooking = require('./models/FarmBooking');
const Message = require('./models/Message');
const T = require('./messageTemplate');

const botService = {};

botService.handleMessage = async (phone, message) => {
  // 1️⃣ Log incoming message
  await Message.create({ phone, sender: 'customer', message });

  // 2️⃣ Get or create session
  let session = await ChatSession.findOne({ phone });
  if (!session) {
    session = await ChatSession.create({ phone });
  }

  const lowerMsg = message.trim().toLowerCase();
  let responseText = '';

  // 3️⃣ Greeting
  if (lowerMsg === 'hi' || session.currentState === 'new') {
    session.currentState = 'awaiting_option';
    session.metaData = {};
    await session.save();
    responseText = T.GREETING;
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 4️⃣ Main Menu
  if (session.currentState === 'awaiting_option') {
    switch (lowerMsg) {
      case '1': {
        // Book a Venue → get categories dynamically
        const categories = await Venue.distinct('category');
        if (!categories.length) {
          responseText = `😔 No venue categories found right now.`;
        } else {
          let msg = `🏛️ What type of venue would you like?\n`;
          categories.forEach((c, i) => msg += `${i + 1}) ${c}\n`);
          msg += `\nReply with the number to choose.`;
          responseText = msg;
          session.currentState = 'choosing_venue_type';
          session.metaData = { categoryList: categories };
          await session.save();
        }
        break;
      }
      case '2': {
        // Book a Farm → get types dynamically
        const types = await Farm.distinct('type');
        if (!types.length) {
          responseText = `😔 No farm types found right now.`;
        } else {
          let msg = `🌿 What type of farm would you like?\n`;
          types.forEach((t, i) => msg += `${i + 1}) ${t}\n`);
          msg += `\nReply with the number to choose.`;
          responseText = msg;
          session.currentState = 'choosing_farm_type';
          session.metaData = { farmTypeList: types };
          await session.save();
        }
        break;
      }
      case '3':
        session.currentState = 'cancelling';
        await session.save();
        responseText = `❌ Please provide your booking ID to cancel:`;
        break;
      case '4':
        session.currentState = 'checking_availability';
        await session.save();
        responseText = `🔍 Do you want to check *venue* or *farm* availability?`;
        break;
      case '5':
        responseText = T.HELP;
        break;
      default:
        responseText = T.INVALID_OPTION;
    }
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 5️⃣ Choosing Venue Type (dynamic)
  if (session.currentState === 'choosing_venue_type') {
    const categories = session.metaData.categoryList || [];
    const idx = parseInt(lowerMsg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= categories.length) {
      return { text: T.INVALID_OPTION };
    }
    const chosenCategory = categories[idx];

    const venues = await Venue.find({ category: chosenCategory }).limit(5);
    if (!venues.length) {
      responseText = T.NO_RESULTS(chosenCategory);
    } else {
      let msg = `🎉 Here are some ${chosenCategory}s:\n`;
      venues.forEach((v, i) => msg += `${i + 1}) ${v.name}\n`);
      msg += `\nReply with the number to choose one, or 0 to go back.`;
      responseText = msg;

      session.currentState = 'booking_venue';
      session.metaData = {
        venueType: chosenCategory,
        venueList: venues.map(v => v._id)
      };
      await session.save();
    }
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 6️⃣ Picking a Venue
  if (session.currentState === 'booking_venue') {
    if (lowerMsg === '0') {
      session.currentState = 'awaiting_option';
      session.metaData = {};
      await session.save();
      responseText = `🔙 Back to main menu. Type "hi" to start over.`;
      await Message.create({ phone, sender: 'bot', message: responseText });
      return { text: responseText };
    }
    const idx = parseInt(lowerMsg) - 1;
    const venueIds = session.metaData.venueList || [];
    if (isNaN(idx) || idx < 0 || idx >= venueIds.length) {
      return { text: T.INVALID_OPTION };
    }
    session.metaData.chosenVenueId = venueIds[idx];
    session.currentState = 'booking_venue_date';
    await session.save();

    responseText = T.DATE_PROMPT;
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 7️⃣ Venue Date & Save Booking
  if (session.currentState === 'booking_venue_date') {
    const chosenVenueId = session.metaData.chosenVenueId;
    const venue = await Venue.findById(chosenVenueId);
    if (!venue) {
      session.currentState = 'awaiting_option';
      session.metaData = {};
      await session.save();
      responseText = `❗️ Something went wrong. Type "hi" to start again.`;
      await Message.create({ phone, sender: 'bot', message: responseText });
      return { text: responseText };
    }
    const inputDate = new Date(lowerMsg);
    if (isNaN(inputDate.getTime())) return { text: T.INVALID_DATE };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inputDate < today) return { text: T.PAST_DATE };

    let customer = await Customer.findOne({ phone });
    if (!customer) customer = await Customer.create({ phone });

    const booking = new VenueBooking({
      customer: customer._id,
      customerName: customer.name || '',
      customerPhone: phone,
      customerEmail: customer.email || '',
      venue: venue._id,
      category: venue.category,
      date: inputDate
    });
    await booking.save();

    session.currentState = 'done';
    session.metaData = {};
    await session.save();

    responseText = `✅ Booking received for ${venue.name} on ${lowerMsg}!`;
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 8️⃣ Choosing Farm Type (dynamic)
  if (session.currentState === 'choosing_farm_type') {
    const types = session.metaData.farmTypeList || [];
    const idx = parseInt(lowerMsg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= types.length) {
      return { text: T.INVALID_OPTION };
    }
    const chosenType = types[idx];

    const farms = await Farm.find({ type: chosenType }).limit(5);
    if (!farms.length) {
      responseText = T.NO_RESULTS(chosenType);
    } else {
      let msg = `🌾 Here are some ${chosenType}s:\n`;
      farms.forEach((f, i) => msg += `${i + 1}) ${f.name}\n`);
      msg += `\nReply with the number to choose one, or 0 to go back.`;
      responseText = msg;

      session.currentState = 'booking_farm';
      session.metaData = {
        farmType: chosenType,
        farmList: farms.map(f => f._id)
      };
      await session.save();
    }
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 9️⃣ Picking a Farm
  if (session.currentState === 'booking_farm') {
    if (lowerMsg === '0') {
      session.currentState = 'awaiting_option';
      session.metaData = {};
      await session.save();
      responseText = `🔙 Back to main menu. Type "hi" to start over.`;
      await Message.create({ phone, sender: 'bot', message: responseText });
      return { text: responseText };
    }
    const idx = parseInt(lowerMsg) - 1;
    const farmIds = session.metaData.farmList || [];
    if (isNaN(idx) || idx < 0 || idx >= farmIds.length) {
      return { text: T.INVALID_OPTION };
    }
    session.metaData.chosenFarmId = farmIds[idx];
    session.currentState = 'booking_farm_date';
    await session.save();

    responseText = T.DATE_PROMPT;
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // 🔟 Farm Date & Save Booking
  if (session.currentState === 'booking_farm_date') {
    const chosenFarmId = session.metaData.chosenFarmId;
    const farm = await Farm.findById(chosenFarmId);
    if (!farm) {
      session.currentState = 'awaiting_option';
      session.metaData = {};
      await session.save();
      responseText = `❗️ Something went wrong. Type "hi" to start again.`;
      await Message.create({ phone, sender: 'bot', message: responseText });
      return { text: responseText };
    }
    const inputDate = new Date(lowerMsg);
    if (isNaN(inputDate.getTime())) return { text: T.INVALID_DATE };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (inputDate < today) return { text: T.PAST_DATE };

    let customer = await Customer.findOne({ phone });
    if (!customer) customer = await Customer.create({ phone });

    const booking = new FarmBooking({
      customer: customer._id,
      customerName: customer.name || '',
      customerPhone: phone,
      customerEmail: customer.email || '',
      farm: farm._id,
      type: farm.type,
      date: inputDate
    });
    await booking.save();

    session.currentState = 'done';
    session.metaData = {};
    await session.save();

    responseText = `✅ Booking received for ${farm.name} on ${lowerMsg}!`;
    await Message.create({ phone, sender: 'bot', message: responseText });
    return { text: responseText };
  }

  // Fallback
  responseText = `🤖 Sorry, I didn't get that. Type "hi" to start over.`;
  await Message.create({ phone, sender: 'bot', message: responseText });
  return { text: responseText };
};

module.exports = botService;
