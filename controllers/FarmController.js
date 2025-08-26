// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const FarmCategory=require("../models/FarmCategory")
const Facility=require("../models/FarmFacility")
const FarmValidation = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Customer=require("../models/CustomerModel")
const Vendor = require("../models/VendorModel");
const Types=require("../models/TypeModel")
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const mongoose=require("mongoose")
const moment=require("moment")
const { Types: MongooseTypes, isValidObjectId } = require('mongoose');

// sendInquiry — Map<Number> safe + daily-zeros fallback to default

exports.sendInquiry = async (req, res) => {
  try {
    // ✅ Validate
    const { error, value } = FarmValidation.farmBookingValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: 'Validation failed', errors: error.details.map(e => e.message) });
    }

    // 🧹 tiny helper to normalize optional strings
    const s = (v) => (typeof v === 'string' ? v.trim() : undefined);

    const {
      customerName,
      customerPhone,
      customerEmail,
      customer,
      farm_id,
      date,
      bookingModes,
      Guest_Count,
      Group_Category,

      // 🆕 Optional extras
      meal1, meal2, meal3, meal4,
      barbequeCharcoal,
      kitchen,
      additionalInfo1,
      additionalInfo2,
    } = value;

    // ✅ Date normalize (midnight) + yyyy-mm-dd (local)
    const normalizedDate = new Date(date);
    if (isNaN(normalizedDate)) return res.status(400).json({ error: 'Invalid date.' });
    normalizedDate.setHours(0, 0, 0, 0);
    const isoDateStr = new Date(normalizedDate.getTime() - normalizedDate.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    // ✅ Farm
    const farmDoc = await Farm.findById(farm_id);
    if (!farmDoc) return res.status(404).json({ error: 'Farm not found' });

    // ✅ Capacity
    if (Number(Guest_Count) > Number(farmDoc.capacity || 0)) {
      return res.status(400).json({ error: `Guest count (${Guest_Count}) exceeds the farm's capacity (${farmDoc.capacity}).` });
    }

    // ✅ Duplicate inquiry guard
    const existingInquiry = await FarmBooking.findOne({
      farm: farm_id,
      date: normalizedDate,
      customerPhone,
      bookingModes: { $in: bookingModes },
      status: { $in: ['pending', 'confirmed'] },
    });
    if (existingInquiry) {
      return res.status(409).json({ error: `You already submitted an inquiry for this farm and slot(s).` });
    }

    // ✅ Disallow combos
    if (bookingModes.includes('full_day') && bookingModes.length > 1) {
      return res.status(400).json({ error: `'full_day' cannot be combined with other slots.` });
    }
    if (bookingModes.includes('full_night') && bookingModes.includes('full_day')) {
      return res.status(400).json({ error: `'full_night' cannot be combined with full_day.` });
    }

    // ✅ Existing confirmed conflicts
    const existingConfirmed = await FarmBooking.find({
      farm: farm_id,
      date: normalizedDate,
      status: 'confirmed',
    });
    const existingModes = existingConfirmed.flatMap(b => b.bookingModes || []);

    if (
      (bookingModes.includes('day_slot') || bookingModes.includes('night_slot') || bookingModes.includes('full_night')) &&
      existingModes.includes('full_day')
    ) {
      return res.status(409).json({ error: `Farm is already confirmed for full day on ${isoDateStr}.` });
    }
    if (bookingModes.includes('full_day') && existingModes.length > 0) {
      return res.status(409).json({ error: `Farm already has confirmed bookings on ${isoDateStr}.` });
    }
    if (
      (bookingModes.includes('full_night') && existingModes.includes('night_slot')) ||
      (bookingModes.includes('night_slot') && existingModes.includes('full_night'))
    ) {
      return res.status(409).json({ error: `Farm already confirmed for a conflicting night slot on ${isoDateStr}.` });
    }

    const conflicting = existingConfirmed.filter(b => (b.bookingModes || []).some(mode => bookingModes.includes(mode)));
    if (conflicting.length > 0) {
      const conflictModes = [...new Set(conflicting.flatMap(b => b.bookingModes))];
      return res.status(409).json({ error: `Farm already confirmed for: ${conflictModes.join(', ')}`, conflict: conflictModes });
    }

    // =========================
    // 💰 PRICING
    // =========================
    const priceBreakdownObj = {}; // plain object first
    const pricingDetails = {};    // optional: rich details
    let totalPrice = 0;

    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    // find daily (yyyy-mm-dd match)
    const matchedDaily = (farmDoc.dailyPricing || []).find(d => {
      const dDate = new Date(d.date);
      if (isNaN(dDate)) return false;
      const local = new Date(dDate.getTime() - dDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      return local === isoDateStr;
    });

    // merged source (default + daily overrides)
    const defaultPricing = farmDoc.defaultPricing || {};
    const mergedSource = { ...defaultPricing };
    if (matchedDaily && matchedDaily.slots && typeof matchedDaily.slots === 'object' && !Array.isArray(matchedDaily.slots)) {
      Object.assign(mergedSource, matchedDaily.slots);
    }

    console.log('🧾 price source picked =>', matchedDaily ? 'merged(default+daily)' : 'default', mergedSource);
    console.log('🧾 raw defaultPricing =>', defaultPricing);
    if (matchedDaily) console.log('🧾 raw daily slots =>', matchedDaily.slots);

    for (const mode of bookingModes) {
      let cfg = mergedSource?.[mode];
      if (cfg === undefined || cfg === null) {
        return res.status(400).json({ error: `Pricing not configured for "${mode}" on ${isoDateStr}.` });
      }

      let base = 0;
      let perGuest = 0;

      if (typeof cfg === 'number') {
        base = num(cfg, 0);
      } else if (typeof cfg === 'object') {
        base = num(cfg.price, 0);
        perGuest = num(cfg.pricePerGuest, 0);

        // 👇 if daily override sets both to 0, fallback to default
        if (base === 0 && perGuest === 0 && defaultPricing?.[mode] != null) {
          const def = defaultPricing[mode];
          if (typeof def === 'number') {
            base = num(def, 0);
            perGuest = 0;
          } else if (typeof def === 'object') {
            base = num(def.price, 0);
            perGuest = num(def.pricePerGuest, 0);
          }
        }
      } else {
        return res.status(400).json({ error: `Invalid pricing format for "${mode}" on ${isoDateStr}.` });
      }

      const guests = num(Guest_Count, 0);
      const subtotal = base + perGuest * guests;

      priceBreakdownObj[mode] = num(subtotal, 0);
      pricingDetails[mode] = {
        source: matchedDaily ? 'daily-override' : 'default',
        base,
        perGuest,
        guests,
        subtotal,
      };

      totalPrice += subtotal;
    }

    // =========================
    // 👤 CUSTOMER UPSERT
    // =========================
    let customerId = customer;
    if (!customerId) {
      const existingCustomer = await Customer.findOne({
        $or: [{ phone: customerPhone }, { email: customerEmail }],
      });
      customerId = existingCustomer
        ? existingCustomer._id
        : (await Customer.create({ name: customerName, phone: customerPhone, email: customerEmail }))._id;
    }

    const generateBookingId = () => Math.floor(100000 + Math.random() * 900000);

    // =========================
    // 📝 SAVE
    // =========================
    const priceBreakdownMap = new Map(Object.entries(priceBreakdownObj));

    const inquiry = new FarmBooking({
      Booking_id: generateBookingId(),
      customerName,
      customerPhone,
      customerEmail,
      customer: customerId,
      farm: farm_id,
      date: normalizedDate,
      bookingModes,
      Group_Category,
      Guest_Count,

      // 🆕 Save optional extras (trimmed if strings present)
      meal1: s(meal1),
      meal2: s(meal2),
      meal3: s(meal3),
      meal4: s(meal4),
      barbequeCharcoal: s(barbequeCharcoal),
      kitchen: s(kitchen),
      additionalInfo1: s(additionalInfo1),
      additionalInfo2: s(additionalInfo2),

      status: 'pending',
      paymentStatus: 'unpaid',
      totalPrice,
      priceBreakdown: priceBreakdownMap,
      meta: { pricingDetails },
      farmSnapshot: {
        name: farmDoc.name,
        location: {
          address: farmDoc.location?.address,
          city: farmDoc.location?.city,
          state: farmDoc.location?.state,
          pinCode: farmDoc.location?.pinCode,
          areaName: farmDoc.location?.areaName,
        },
      },
    });

    await inquiry.save();

    // =========================
    // 📤 RESPONSE (normalize Map→object)
    // =========================
    const data = inquiry.toObject({ virtuals: true, getters: true });
    const pb = data.priceBreakdown instanceof Map
      ? Object.fromEntries(data.priceBreakdown)
      : (typeof data.priceBreakdown === 'object' && data.priceBreakdown !== null
          ? data.priceBreakdown
          : Object.fromEntries(priceBreakdownMap));
    data.priceBreakdown = pb;

    return res.status(201).json({
      message: 'Inquiry submitted successfully!',
      data,
    });
  } catch (err) {
    console.error('[FarmInquiry Error]', err);
    return res.status(500).json({ error: 'Server error. Try again later.' });
  }
};




exports.getMonthlyFarmBookings = async (req, res) => {
  try {
    // ✅ Validate input (MM/YYYY format)
    const { error, value } = FarmValidation.monthYearSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { monthYear } = value;
    const [monthStr, yearStr] = monthYear.split('/');
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // ✅ Get all active and approved farms (include unavailableDates)
    const farms = await Farm.find({ isActive: true, isApproved: true }, '_id unavailableDates');
    const farmIds = farms.map(f => f._id.toString());

    // ✅ Build map of farm → blocked dates (ISO string)
    const blockedMap = {};
    farms.forEach(f => {
      blockedMap[f._id.toString()] = new Set(
        (f.unavailableDates || []).map(d => d.toISOString().split('T')[0])
      );
    });

    // ✅ Fetch all bookings for the month
    const bookings = await FarmBooking.find({
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    });

    // ✅ Build a booking map: { date: { farmId: Set of booked modes } }
    const bookingMap = {};

    bookings.forEach(b => {
      const dayKey = b.date.toISOString().split('T')[0];
      const farmId = b.farm.toString();

      if (!bookingMap[dayKey]) bookingMap[dayKey] = {};
      if (!bookingMap[dayKey][farmId]) bookingMap[dayKey][farmId] = new Set();

      b.bookingModes.forEach(mode => bookingMap[dayKey][farmId].add(mode));
    });

    // ✅ Final calendar result
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayBookings = bookingMap[dateStr] || {};

      let fullyBookedCount = 0;
      let partialAvailable = false;
      let hasCompletelyFreeFarm = false;

      for (const farmId of farmIds) {
        const isBlocked = blockedMap[farmId]?.has(dateStr);

        if (isBlocked) {
          fullyBookedCount++;
          continue;
        }

        const bookedModes = dayBookings[farmId] || new Set();

        if (bookedModes.size === 0) {
          hasCompletelyFreeFarm = true;
          break; // If even one farm is fully free
        } else if (bookedModes.size < 3) {
          partialAvailable = true;
        } else {
          fullyBookedCount++;
        }
      }

      result.push({
        date: dateStr,
        Full_available: hasCompletelyFreeFarm,
        partial_Available: !hasCompletelyFreeFarm && partialAvailable
      });
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Calendar booking fetch error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// for filter home page

exports.FilterQueeryHomePage = async (req, res) => {
  try {
    // ✅ Validate input
    const { error, value } = FarmValidation.FilterQueeryHomePageScheam.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map(err => err.message).join(', ')
      });
    }

    const { date, category, capacityRange } = value;
    const { min, max } = capacityRange;

    const isoDateStr = new Date(date).toISOString().split('T')[0];

// Build exact day range
const start = new Date(`${isoDateStr}T00:00:00.000Z`);
const end = new Date(`${isoDateStr}T23:59:59.999Z`);
  

    // ✅ Step 1: Verify category exists
    const foundCategory = await FarmCategory.findById(category);
    if (!foundCategory) {
      return res.status(404).json({
        success: false,
        message: 'The selected category does not exist.'
      });
    }

    // ✅ Step 2: Get farms in that category
    const categoryFarms = await Farm.find({
    farmCategory: { $in: [category] },
      isActive: true,
      isApproved: true
    });

    if (categoryFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No farms found under the selected category "${foundCategory.name}".`
      });
    }

    // ✅ Step 3: Filter farms by capacity range
    const capacityFarms = categoryFarms.filter(farm => (
      farm.capacity >= min && farm.capacity <= max
    ));

    if (capacityFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No farms found under category "${foundCategory.name}" with capacity between ${min} and ${max}.`
      });
    }

    // ✅ Step 4: Filter out farms blocked by vendor on the selected date
    const farmsNotBlocked = capacityFarms.filter(farm => {
      const blockedDates = (farm.unavailableDates || []).map(d =>
        new Date(d).toISOString().split('T')[0]
      );
      return !blockedDates.includes(isoDateStr);
    });

    if (farmsNotBlocked.length === 0) {
      return res.status(404).json({
        success: false,
        message: `All farms under category "${foundCategory.name}" with capacity between ${min} and ${max} are blocked on ${isoDateStr}.`
      });
    }

    const farmIds = farmsNotBlocked.map(f => f._id);

    // ✅ Step 5: Fetch bookings for the given date
    const bookings = await FarmBooking.find({
      farm: { $in: farmIds },
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] }
    });

    // ✅ Step 6: Build farmId → bookedModes map
    const bookingMap = {};
    bookings.forEach(b => {
      const farmId = b.farm.toString();
      if (!bookingMap[farmId]) bookingMap[farmId] = new Set();
      b.bookingModes.forEach(mode => bookingMap[farmId].add(mode));
    });

    // ✅ Step 7: Filter farms that are not fully booked
    const allModes = ['full_day', 'day_slot', 'night_slot'];
    const availableFarms = farmsNotBlocked.filter(farm => {
      const bookedModes = bookingMap[farm._id.toString()] || new Set();
      return !allModes.every(mode => bookedModes.has(mode));
    });

    if (availableFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `All farms under category "${foundCategory.name}" with capacity between ${min} and ${max} are fully booked on ${isoDateStr}.`
      });
    }

    // ✅ Success Response
 return res.status(200).json({
  success: true,
  message: `${availableFarms.length} farm(s) available on ${isoDateStr}.`,
  data: availableFarms
});

  } catch (err) {
    console.error('FilterQueeryHomePage error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.getFarmById = async (req, res) => {
  try {
    const { error, value } = FarmValidation.getFarmByIdSchema.validate({ farmId: req.body.farmId });
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const farm = await Farm.findById(value.farmId)
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name icon')
      .populate('types', '_id name')
      .populate('owner', '_id name email phone');

    if (!farm || !farm.isActive || !farm.isApproved) {
      return res.status(404).json({ success: false, message: 'Farm not found or inactive/unapproved.' });
    }

    const today = moment().startOf('day');
    const next30Days = Array.from({ length: 30 }, (_, i) => today.clone().add(i, 'days'));
    const blockedMap = {};

    (farm.unavailableDates || []).forEach(entry => {
      const dateStr = moment(entry.date).format('YYYY-MM-DD');
      blockedMap[dateStr] = new Set(entry.blockedSlots || []);
    });

    const confirmedBookings = await FarmBooking.find({
      farm: farm._id,
      status: 'confirmed',
      date: { $gte: today.toDate(), $lte: next30Days[next30Days.length - 1].toDate() }
    });

    confirmedBookings.forEach(b => {
      const dateStr = moment(b.date).format('YYYY-MM-DD');
      const nextDateStr = moment(b.date).add(1, 'day').format('YYYY-MM-DD');

      if (!blockedMap[dateStr]) blockedMap[dateStr] = new Set();
      if (!blockedMap[nextDateStr]) blockedMap[nextDateStr] = new Set();

      const modes = b.bookingModes;

      if (modes.includes('full_day')) {
        blockedMap[dateStr].add('full_day');
        blockedMap[dateStr].add('day_slot');
        blockedMap[dateStr].add('night_slot');
        blockedMap[dateStr].add('full_night');
      }

      if (modes.includes('day_slot')) {
        blockedMap[dateStr].add('day_slot');
        blockedMap[dateStr].add('full_day');
        blockedMap[dateStr].add('full_night');
      }

      if (modes.includes('night_slot')) {
        blockedMap[dateStr].add('night_slot');
        blockedMap[dateStr].add('full_day');
        blockedMap[dateStr].add('full_night');
      }

      if (modes.includes('full_night')) {
        blockedMap[dateStr].add('night_slot');
        blockedMap[dateStr].add('full_day');
        blockedMap[dateStr].add('full_night');
        blockedMap[nextDateStr].add('day_slot');
      }
    });

    const allModes = ['full_day', 'day_slot', 'night_slot', 'full_night'];

    const availability = next30Days.map(dayMoment => {
      const dateStr = dayMoment.format('YYYY-MM-DD');
      const dayName = dayMoment.format('dddd');
      const blockedSlots = blockedMap[dateStr] || new Set();

      const slots = {};
      allModes.forEach(mode => {
        slots[mode] = !blockedSlots.has(mode);
      });

      return { date: dateStr, dayName, availableSlots: slots };
    });

    const farmObj = farm.toObject();
    if (Array.isArray(farmObj.dailyPricing)) {
      farmObj.dailyPricing = farmObj.dailyPricing.map(dp => ({
        ...dp,
        checkIn: dp.checkIn ? moment(dp.checkIn, 'HH:mm').format('hh:mm A') : '10:00 AM',
        checkOut: dp.checkOut ? moment(dp.checkOut, 'HH:mm').format('hh:mm A') : '06:00 PM'
      }));
    }

    return res.status(200).json({
      success: true,
      message: 'Farm fetched successfully.',
      data: {
        ...farmObj,
        availability
      }
    });

  } catch (err) {
    console.error('[GetFarmById Error]', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};



exports.getFarmByImageUrl = async (req, res) => {
  try {
    console.log('req.body printing:', req.body);

    // ✅ Validate body
    const { error, value } = FarmValidation.getFarmByImageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { farmId, imageurl } = value;
    console.log('farmId:', farmId, 'imageurl:', imageurl);

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Farm ID.'
      });
    }

    // ✅ Search for farm by ID and image match
    const farm = await Farm.findOne({
      _id: farmId,
      images: imageurl,
      isActive: true,
      isApproved: true
    })
      .populate('farmCategory', '_id name')  // ✅ Only fetch _id and name
      .populate('facilities', '_id name');   // ✅ Only fetch _id and name

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'No farm found with the provided ID and image URL.'
      });
    }

    // ✅ Respond with populated farm details
    return res.status(200).json({
      success: true,
      message: 'Farm found successfully.',
      data: farm
    });

  } catch (err) {
    console.error('[GetFarmByImageUrl Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

const cleanInput = (input) => {
  const clone = { ...input };

  // Clean top-level dates
  if (clone.startDate === '') clone.startDate = undefined;
  if (clone.endDate === '') clone.endDate = undefined;

  // Clean capacityRange if min/max is empty
  if (clone.capacityRange) {
    const { min, max } = clone.capacityRange;
    if (min === '' || max === '') {
      delete clone.capacityRange;
    }
  }

  // Clean priceRange if min/max is empty
  if (clone.priceRange) {
    const { min, max } = clone.priceRange;
    if (min === '' || max === '') {
      delete clone.priceRange;
    }
  }

  return clone;
};

// without type filter 


// exports.FilterQueeryFarms = async (req, res) => {
//   try {
//     const cleanedBody = cleanInput(req.body);
//     const { error, value } = FarmValidation.FilterQueeryFarm.validate(cleanedBody);

//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: error.details[0].message
//       });
//     }

//     const {
//       startDate,
//       endDate,
//       farmCategory = [],
//       capacityRange,
//       priceRange,
//       facilities = [],
//       types = [],
//       page = 1,
//       limit = 10
//     } = value;

//     const now = new Date();

//     const start = startDate ? new Date(startDate) : new Date(now.toISOString().split('T')[0]);
//     if (isNaN(start.getTime())) {
//       return res.status(400).json({ success: false, message: 'Invalid startDate format.' });
//     }

//     const end = endDate
//       ? new Date(endDate)
//       : new Date(new Date(start).setDate(start.getDate() + 7));
//     if (isNaN(end.getTime())) {
//       return res.status(400).json({ success: false, message: 'Invalid endDate format.' });
//     }

//     const allDates = [];
//     for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
//       const clone = new Date(d);
//       if (!isNaN(clone.getTime())) {
//         allDates.push(clone.toISOString().split('T')[0]);
//       }
//     }

//     // ✅ Base query always requires active + approved farms
//     const baseQuery = { isActive: true, isApproved: true };
//     if (farmCategory.length > 0) {
//       baseQuery.farmCategory = { $in: farmCategory };
//     }

//     let farms = await Farm.find(baseQuery)
//       .populate('farmCategory', '_id name')
//       .populate('facilities', '_id name')
//       .populate('types', '_id name');

//     if (!farms.length) {
//       return res.status(200).json({
//         success: false,
//         message:
//           farmCategory.length > 0
//             ? 'No active and approved farms found for the selected categories.'
//             : 'No active and approved farms found.'
//       });
//     }

//     // 🧮 capacity filter
//     if (capacityRange) {
//       const { min: capMin, max: capMax } = capacityRange;
//       farms = farms.filter(f => f.capacity >= capMin && f.capacity <= capMax);
//       if (!farms.length) {
//         return res.status(200).json({
//           success: false,
//           message: `No farms found in the capacity range ${capMin}–${capMax}.`
//         });
//       }
//     }

//     // 🧩 facilities filter
//     if (Array.isArray(facilities) && facilities.length > 0) {
//       const facilitySet = new Set(facilities.map(String));
//       farms = farms.filter(farm =>
//         Array.isArray(farm.facilities) &&
//         farm.facilities.some(f => facilitySet.has(String(f._id)))
//       );
//       if (!farms.length) {
//         return res.status(200).json({
//           success: false,
//           message: 'No farms found with any of the selected facilities.'
//         });
//       }
//     }

//     // 🧩 types filter
//     if (Array.isArray(types) && types.length > 0) {
//       const typesSet = new Set(types.map(String));
//       farms = farms.filter(farm => {
//         const assigned = Array.isArray(farm.Types) ? farm.Types : [];
//         for (const t of assigned) {
//           const tid = t && t._id ? String(t._id) : String(t);
//           if (typesSet.has(tid)) return true;
//         }
//         return false;
//       });
//       if (!farms.length) {
//         return res.status(200).json({
//           success: false,
//           message: 'No farms found with any of the selected types.'
//         });
//       }
//     }

//     // 💰 price filter
//     if (priceRange) {
//       const { min: priceMin, max: priceMax } = priceRange;

//       farms = farms.filter(farm => {
//         let isWithinRange = false;

//         for (const dateStr of allDates) {
//           const dailyEntry = farm.dailyPricing?.find(d => {
//             const dt = new Date(d.date);
//             return !isNaN(dt.getTime()) &&
//               dt.toISOString().split('T')[0] === dateStr;
//           });

//           console.log("farm Default price printing",farm.defaultPricing)
//           const slotPrices = dailyEntry?.slots || farm.defaultPricing || {};
//           console.log("slot prices printing",slotPrices)
//           const prices = [
//             slotPrices.full_day,
//             slotPrices.day_slot,
//             slotPrices.night_slot
//           ];

//           if (
//             prices.some(
//               p => typeof p === 'number' && p >= priceMin && p <= priceMax
//             )
//           ) {
//             isWithinRange = true;
//             break;
//           }
//         }

//         return isWithinRange;
//       });

//       if (!farms.length) {
//         return res.status(200).json({
//           success: false,
//           message: `No farms found in the price range ₹${priceMin}–₹${priceMax}.`
//         });
//       }
//     }

//     // 📚 bookings
//     const bookings = await FarmBooking.find({
//       farm: { $in: farms.map(f => f._id) },
//       date: { $gte: start, $lte: end },
//       status: { $in: ['pending', 'confirmed'] }
//     });

//     const bookingMap = {};
//     bookings.forEach(b => {
//       const fid = b.farm.toString();
//       const dateStr = new Date(b.date).toISOString().split('T')[0];
//       if (!bookingMap[fid]) bookingMap[fid] = {};
//       if (!bookingMap[fid][dateStr]) bookingMap[fid][dateStr] = new Set();
//       b.bookingModes.forEach(mode => bookingMap[fid][dateStr].add(mode));
//     });

//     const allModes = ['full_day', 'day_slot', 'night_slot'];

//     const availableFarms = farms.filter(farm => {
//       const blockedDates = (farm.unavailableDates || []).map(d => {
//         const dt = new Date(d);
//         return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : null;
//       }).filter(Boolean);

//       const fid = farm._id.toString();

//       for (const date of allDates) {
//         if (blockedDates.includes(date)) return false;
//         const bookedModes = bookingMap[fid]?.[date] || new Set();
//         if (allModes.every(mode => bookedModes.has(mode))) return false;
//       }

//       return true;
//     });

//     if (!availableFarms.length) {
//       return res.status(200).json({
//         success: false,
//         message: `No active and approved farms fully available between ${start.toDateString()} and ${end.toDateString()}.`
//       });
//     }

//     // 📄 pagination
//     const skip = (page - 1) * limit;
//     const paginatedFarms = availableFarms.slice(skip, skip + limit);

//     // dayName add-on
//     for (let i = 0; i < paginatedFarms.length; i++) {
//       const farm = paginatedFarms[i];
//       const farmObj = farm.toObject();

//       if (Array.isArray(farmObj.dailyPricing)) {
//         farmObj.dailyPricing = farmObj.dailyPricing.map(entry => {
//           const dateObj = new Date(entry.date);
//           const isValidDate = !isNaN(dateObj.getTime());

//           return {
//             ...entry,
//             dayName: isValidDate
//               ? dateObj.toLocaleDateString('en-IN', { weekday: 'long' })
//               : null
//           };
//         });
//       }

//       paginatedFarms[i] = farmObj;
//     }

//     return res.status(200).json({
//       success: true,
//       message: `${availableFarms.length} active & approved farm(s) available from ${start.toDateString()} to ${end.toDateString()}.`,
//       pagination: {
//         total: availableFarms.length,
//         page,
//         limit,
//         totalPages: Math.ceil(availableFarms.length / limit)
//       },
//       data: paginatedFarms
//     });

//   } catch (err) {
//     console.error('Farm filter query error:', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error. Please try again later.'
//     });
//   }
// };

exports.FilterQueeryFarms = async (req, res) => {
  try {
    const cleanedBody = cleanInput(req.body);
    const { error, value } = FarmValidation.FilterQueeryFarm.validate(cleanedBody);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const {
      startDate,
      endDate,
      farmCategory = [],
      capacityRange,
      priceRange,
      facilities = [],
      types = [],
      page = 1,
      limit = 10
    } = value;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Use body dates if provided, else default
    let start = startDate ? new Date(startDate) : new Date(now);
    let end = endDate ? new Date(endDate) : new Date(now);

    if (!startDate) {
      end.setDate(start.getDate() + 60); // default 60 days
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format.' });
    }

    // Create array of all dates in range
    const allDates = [];
    let d = new Date(start);
    while (d <= end) {
      allDates.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }

    // Base query for active + approved farms
    const baseQuery = { isActive: true, isApproved: true };
    if (farmCategory.length > 0) {
      baseQuery.farmCategory = { $in: farmCategory };
    }

    let farms = await Farm.find(baseQuery)
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name')
      .populate('types', '_id name');

    if (!farms.length) {
      return res.status(200).json({
        success: false,
        message:
          farmCategory.length > 0
            ? 'No active and approved farms found for the selected categories.'
            : 'No active and approved farms found.'
      });
    }

    // Filter by capacity
    if (capacityRange) {
      const { min: capMin, max: capMax } = capacityRange;
      farms = farms.filter(f => f.capacity >= capMin && f.capacity <= capMax);
    }

    // Filter by facilities
    if (facilities.length > 0) {
      const facilitySet = new Set(facilities.map(String));
      farms = farms.filter(farm =>
        Array.isArray(farm.facilities) &&
        farm.facilities.some(f => facilitySet.has(String(f._id)))
      );
    }

    // Filter by types
    if (types.length > 0) {
      const typesSet = new Set(types.map(String));
      farms = farms.filter(farm => {
        const assigned = Array.isArray(farm.types) ? farm.types : [];
        return assigned.some(t => typesSet.has(String(t?._id || t)));
      });
    }

    // Filter by price range
    if (priceRange) {
      const { min: priceMin, max: priceMax } = priceRange;

      farms = farms.filter(farm => {
        return allDates.some(dateStr => {
          const dailyEntry = farm.dailyPricing?.find(d => {
            const dt = new Date(d.date);
            return !isNaN(dt.getTime()) &&
              dt.toISOString().split('T')[0] === dateStr;
          });

          let slotPrices = dailyEntry?.slots || farm.defaultPricing || {};
          let prices = Object.values(slotPrices).map(s => s?.pricePerGuest || 0);

          return prices.some(p => p >= priceMin && p <= priceMax);
        });
      });
    }

    // Get all bookings in the date range
    const bookings = await FarmBooking.find({
      farm: { $in: farms.map(f => f._id) },
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] }
    });

    const bookingMap = {};
    bookings.forEach(b => {
      const fid = b.farm.toString();
      const dateStr = new Date(b.date).toISOString().split('T')[0];
      if (!bookingMap[fid]) bookingMap[fid] = {};
      if (!bookingMap[fid][dateStr]) bookingMap[fid][dateStr] = new Set();
      b.bookingModes.forEach(mode => bookingMap[fid][dateStr].add(mode));
    });

    const allModes = ['full_day', 'day_slot', 'night_slot', 'full_night'];

    // Map farms with availability per slot per date
    const availableFarms = farms.map(farm => {
      const farmObj = farm.toObject();
      farmObj.availability = {};

      allDates.forEach(dateStr => {
        const blockedEntry = (farm.unavailableDates || []).find(
          d => new Date(d.date).toISOString().split('T')[0] === dateStr
        );
        const bookedModes = bookingMap[farm._id.toString()]?.[dateStr] || new Set();
        const offeredSlots = allModes.filter(mode => farm.bookingModes[mode]);

        farmObj.availability[dateStr] = offeredSlots.reduce((acc, mode) => {
          acc[mode] = !bookedModes.has(mode) && !(blockedEntry?.blockedSlots || []).includes(mode);
          return acc;
        }, {});
      });

      return farmObj;
    });

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedFarms = availableFarms.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      message: `${availableFarms.length} active & approved farm(s) available from ${start.toDateString()} to ${end.toDateString()}.`,
      pagination: {
        total: availableFarms.length,
        page,
        limit,
        totalPages: Math.ceil(availableFarms.length / limit)
      },
      data: paginatedFarms
    });

  } catch (err) {
    console.error('Farm filter query error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};



exports.getFarmCategories = async (req, res) => {
  try {
    // Optional: validate query if needed
    const { error } = FarmValidation.getCategoriesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 1️⃣ Get distinct farmCategory IDs from Farm collection
    const categoryIds = await Farm.distinct('farmCategory')

    console.log("farm categoruies printing",categoryIds)

    if (!categoryIds || categoryIds.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No farm categories associated with any farm.'
      });
    }

    // 2️⃣ Get FarmCategory documents matching those IDs
    const categories = await FarmCategory.find({ _id: { $in: categoryIds } }, '_id name').sort({ name: 1 });

    return res.status(200).json({
      success: true,
      message: 'Farm categories fetched successfully.',
      data: categories
    });

  } catch (err) {
    console.error('Category fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.getUsedFacilities = async (req, res) => {
  try {
    // 🔐 Validate query
    const { error } = FarmValidation.getFacilitiesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 1️⃣ Fetch used facility IDs
    const facilityIds = await Farm.distinct('facilities')

    if (!facilityIds.length) {
      return res.status(404).json({
        success: false,
        message: 'No facilities are currently associated with any farm.'
      });
    }

    // 2️⃣ Get full facility details
    const facilities = await Facility.find(
      { _id: { $in: facilityIds } },
      '_id name class_name'
    ).sort({ name: 1 });
//  console.log("facilites printing",facilities)
    return res.status(200).json({
      success: true,
      message: 'Facilities fetched successfully.',
      data: facilities
    });

  } catch (err) {
    console.error('Facility fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.getFarmTypes = async (req, res) => {
  try {
    // Optional: validate query if you’ve got a schema for it
    const { error } = FarmValidation.getFarmTypeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 1️⃣ Get distinct Type IDs from farms that are active + approved
    let typeIds = await Farm.distinct('types')

    // filter out null/undefined just in case
    typeIds = (typeIds || []).filter(Boolean);

    if (!typeIds.length) {
      return res.status(404).json({
        success: false,
        message: 'No types associated with any farm.'
      });
    }

    // 2️⃣ Fetch Types docs for those IDs (only _id, name), sorted A→Z
    const types = await Types.find(
      { _id: { $in: typeIds } },
      '_id name'
    ).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      message: 'Farm types fetched successfully.',
      data: types
    });
  } catch (err) {
    console.error('Type fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};
// exports.getFarmImagesByCategories = async (req, res) => {
//   try {
//     // ✅ Validate route param (categoryId)
//     console.log("req.parms priting",req.body)
//     const { error, value } = FarmValidation.getImagesByFarmTypeSchema.validate(req.body);
//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: error.details[0].message
//       });
//     }

//     const { categoryId } = value;

//     if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid category ID.'
//       });
//     }

//     // ✅ Check if category exists
//     const categoryExists = await FarmCategory.exists({ _id: categoryId });
//     if (!categoryExists) {
//       return res.status(404).json({
//         success: false,
//         message: 'Farm category not found.'
//       });
//     }

//     // ✅ Find farms that reference this category
//     const farms = await Farm.find(
//       {
//         farmCategory: categoryId,
//         isActive: true,
//         isApproved: true
//       },
//       'images'
//     );

//     if (!farms.length) {
//       return res.status(404).json({
//         success: false,
//         message: 'No farms found for this category.'
//       });
//     }

//     // ✅ Extract and flatten all image URLs
//     const allImages = farms.flatMap(farm => farm.images || []);

//     if (!allImages.length) {
//       return res.status(404).json({
//         success: false,
//         message: 'No images found for farms of this category.'
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `${allImages.length} image(s) found for this category.`,
//       data: allImages
//     });

//   } catch (err) {
//     console.error('[GetFarmImagesByCategory Error]', err);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error. Please try again later.'
//     });
//   }
// };



exports.getFarmImagesByCategories = async (req, res) => {
  try {
    console.log("req.body printing", req.body);

    const { error, value } = FarmValidation.getImagesByFarmTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { categoryId } = value;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID.'
      });
    }

    // ✅ Check if category exists
    const categoryExists = await FarmCategory.exists({ _id: categoryId });
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Farm category not found.'
      });
    }

    // ✅ Find farms that reference this category
    const farms = await Farm.find(
      {
        farmCategory: categoryId,
        isActive: true,
        isApproved: true
      },
      '_id images'
    );

    if (!farms.length) {
      return res.status(404).json({
        success: false,
        message: 'No farms found for this category.'
      });
    }

    // ✅ Extract images along with farmId
    const allImagesWithFarmId = farms.flatMap(farm =>
      (farm.images || []).map(img => ({
        farmId: farm._id,
        image: img
      }))
    );

    if (!allImagesWithFarmId.length) {
      return res.status(404).json({
        success: false,
        message: 'No images found for farms of this category.'
      });
    }

    res.status(200).json({
      success: true,
      message: `${allImagesWithFarmId.length} image(s) found for this category.`,
      data: allImagesWithFarmId
    });

  } catch (err) {
    console.error('[GetFarmImagesByCategory Error]', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


