// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const FarmCategory=require("../models/FarmCategory")
const Facility=require("../models/FarmFacility")
const { monthYearSchema,blockDateSchema, farmBookingValidationSchema, FilterQueeryHomePageScheam, getCategoriesSchema, getFarmByIdSchema, getFarmByImageSchema, FilterQueeryFarm, getImagesByFarmTypeSchema, unblockDateSchema, getFacilitiesSchema } = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Customer=require("../models/CustomerModel")
const Vendor = require("../models/VendorModel");
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const mongoose=require("mongoose")
const moment=require("moment")
const { DateTime } = require('luxon'); // optional: for clean date handling (recommended)



exports.unblockDate = async (req, res) => {
  const vendorId = req.user.id;

  // ✅ Validate using external Joi schema
  const { error, value } = unblockDateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.details.map(e => e.message),
    });
  }

  const { farmId, dates } = value;

  try {
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found. Please verify the farm ID.' });
    }

    if (farm.owner.toString() !== vendorId) {
      return res.status(403).json({ message: 'Access denied. You do not own this farm.' });
    }

    const existingSet = new Set(
      farm.unavailableDates.map(d => DateTime.fromJSDate(d).toISODate())
    );

    const toUnblockSet = new Set(
      dates.map(d => DateTime.fromJSDate(new Date(d)).toISODate())
    );

    const remainingDates = farm.unavailableDates.filter(d => {
      const iso = DateTime.fromJSDate(d).toISODate();
      return !toUnblockSet.has(iso);
    });

    const unblocked = [...existingSet].filter(d => toUnblockSet.has(d));
    const notBlocked = [...toUnblockSet].filter(d => !existingSet.has(d));

    if (unblocked.length > 0) {
      farm.unavailableDates = remainingDates;
      await farm.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Farm availability updated.',
      summary: {
        unblockedCount: unblocked.length,
        notBlockedCount: notBlocked.length,
      },
      details: {
        unblocked,
        notBlocked,
        currentUnavailableDates: farm.unavailableDates.map(d => d.toISOString()),
      },
    });

  } catch (err) {
    console.error('Error while unblocking dates:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while unblocking dates.',
    });
  }
};
exports.blockDate = async (req, res) => {
  const vendorId = req.user.id;

  // ✅ Joi validation should already be done before reaching this controller
  const { farmId, dates } = req.body;

  try {
    // 1. Fetch the farm
    const farm = await Farm.findById(farmId);
    if (!farm) {
      return res.status(404).json({ message: 'Farm not found. Please verify the farm ID.' });
    }

    // 2. Confirm ownership
    if (farm.owner.toString() !== vendorId) {
      return res.status(403).json({ message: 'Access denied. You do not own this farm.' });
    }

    // 3. Normalize existing blocked dates
    const existingDatesISO = farm.unavailableDates.map(d =>
      DateTime.fromJSDate(d).toISODate()
    );

    // 4. Process requested dates
    const newlyBlocked = [];
    const alreadyBlocked = [];

    for (const rawDate of dates) {
      const dateObj = new Date(rawDate);
      const isoDate = DateTime.fromJSDate(dateObj).toISODate();

      if (!existingDatesISO.includes(isoDate)) {
        farm.unavailableDates.push(dateObj);
        newlyBlocked.push(isoDate);
        existingDatesISO.push(isoDate); // prevent future duplicate detection in same loop
      } else {
        alreadyBlocked.push(isoDate);
      }
    }

    // 5. Save updates if needed
    if (newlyBlocked.length > 0) {
      await farm.save();
    }

    // 6. Respond clearly
    return res.status(200).json({
      success: true,
      message: 'Farm availability updated.',
      summary: {
        newlyBlockedCount: newlyBlocked.length,
        alreadyBlockedCount: alreadyBlocked.length,
      },
      details: {
        newlyBlocked,
        alreadyBlocked,
        allUnavailableDates: farm.unavailableDates.map(d => d.toISOString()),
      },
    });
  } catch (err) {
    console.error('Error while blocking dates:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while blocking dates. Please try again later.',
    });
  }
};

exports.bookFarm = async (req, res) => {
  try {
    const { error, value } = farmBookingValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { customerName, customerPhone, customerEmail, customer, farm_id, date, bookingModes } = value;
    const normalizedDate = new Date(date);
    const isoDateStr = normalizedDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // ✅ Step 1: Find farm
    const farmDoc = await Farm.findById(farm_id);
    if (!farmDoc) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // ✅ Step 2: Block-date check
    const blockedDates = (farmDoc.unavailableDates || []).map(d =>
      new Date(d).toISOString().split('T')[0]
    );

    if (blockedDates.includes(isoDateStr)) {
      return res.status(403).json({
        error: `This farm is not accepting bookings on ${isoDateStr}. Please select another date.`
      });
    }

    // ✅ Step 3: Check for existing bookings on this date
    const existing = await FarmBooking.find({
      farm: farm_id,
      date: normalizedDate,
      bookingModes: { $in: bookingModes },
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing.length > 0) {
      const conflictModes = [...new Set(existing.flatMap(b => b.bookingModes))];
      return res.status(409).json({
        error: `Farm already booked for the following slot(s) on ${isoDateStr}: ${conflictModes.join(', ')}`,
        conflict: conflictModes
      });
    }

    // ✅ Step 4: Calculate totalPrice + breakdown (based on dailyPricing or defaultPricing)
    const priceBreakdown = {};
    let totalPrice = 0;

    // Step 4A: Find date-specific pricing if exists
    const matchedDaily = farmDoc.dailyPricing?.find(
      d => new Date(d.date).toISOString().split('T')[0] === isoDateStr
    );

    const priceSource = matchedDaily?.slots || farmDoc.defaultPricing || {};

    for (let mode of bookingModes) {
      const modePrice = priceSource[mode];
      if (typeof modePrice !== 'number') {
        return res.status(400).json({
          error: `Pricing not configured for mode "${mode}" on ${isoDateStr}.`
        });
      }
      priceBreakdown[mode] = modePrice;
      totalPrice += modePrice;
    }

    // ✅ Step 5: Resolve customer
    let customerId = customer;
    if (!customerId) {
      let existingCustomer = await Customer.findOne({
        $or: [
          { phone: customerPhone },
          { email: customerEmail }
        ]
      });

      if (!existingCustomer) {
        const newCustomer = await Customer.create({
          name: customerName,
          phone: customerPhone,
          email: customerEmail
        });
        customerId = newCustomer._id;
      } else {
        customerId = existingCustomer._id;
      }
    }

    // ✅ Step 6: Save booking
    const booking = new FarmBooking({
      customerName,
      customerPhone,
      customerEmail,
      customer: customerId,
      farm: farm_id,
      farmType: farmDoc.farmType,
      date: normalizedDate,
      bookingModes,
      status: value.status || 'pending',
      paymentStatus: value.paymentStatus || 'unpaid',
      totalPrice,
      priceBreakdown
    });

    await booking.save();

    const plainBooking = booking.toObject();
    plainBooking.priceBreakdown = Object.fromEntries(booking.priceBreakdown);

    return res.status(201).json({
      message: 'Farm booked successfully!',
      data: plainBooking
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate booking detected. A booking for the same farm and date already exists.'
      });
    }

    console.error('[FarmBooking Error]', err);
    res.status(500).json({ error: 'Server error. Try again later.' });
  }
};

exports.getMonthlyFarmBookings = async (req, res) => {
  try {
    // ✅ Validate input (MM/YYYY format)
    const { error, value } = monthYearSchema.validate(req.query);
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
    const { error, value } = FilterQueeryHomePageScheam.validate(req.body);
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
    const { error, value } = getFarmByIdSchema.validate({ farmId: req.body.farmId });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 🔍 Get the farm with populated refs
    const farm = await Farm.findById(value.farmId)
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name icon')
      .populate('owner', '_id name email phone');

    if (!farm || !farm.isActive || !farm.isApproved) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found or inactive/unapproved.'
      });
    }

    // 📅 Get next 7 days (from today)
    const today = moment().startOf('day');
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
      next7Days.push(today.clone().add(i, 'days'));
    }

    // 🛑 Remove unavailableDates
    const blockedDates = (farm.unavailableDates || []).map(date =>
      moment(date).format('YYYY-MM-DD')
    );

    // 📦 Fetch bookings for this farm in the next 7 days
    const bookings = await FarmBooking.find({
      farm: farm._id,
      date: {
        $gte: today.toDate(),
        $lte: today.clone().add(6, 'days').endOf('day').toDate()
      },
      status: { $in: ['pending', 'confirmed'] }
    });

    // 📊 Create map of booked modes by date
    const bookingMap = {};
    bookings.forEach(booking => {
      const dateStr = moment(booking.date).format('YYYY-MM-DD');
      if (!bookingMap[dateStr]) bookingMap[dateStr] = new Set();
      booking.bookingModes.forEach(mode => bookingMap[dateStr].add(mode));
    });

    const allModes = ['full_day', 'day_slot', 'night_slot'];

    // ✅ Build availability array with day name
    const availability = next7Days.map(dayMoment => {
      const dateStr = dayMoment.format('YYYY-MM-DD');
      const dayName = dayMoment.format('dddd'); // ✅ Get day name
      const isBlocked = blockedDates.includes(dateStr);
      const booked = bookingMap[dateStr] || new Set();

      const slots = {};
      allModes.forEach(mode => {
        slots[mode] = !isBlocked && !booked.has(mode);
      });

      return {
        date: dateStr,
        dayName,
        availableSlots: slots
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Farm fetched successfully.',
      data: {
        ...farm.toObject(),
        availability
      }
    });

  } catch (err) {
    console.error('[GetFarmById Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


exports.getFarmByImageUrl = async (req, res) => {
  try {
    // 1️⃣ Validate query param
    console.log('req.query printing:', req.query);

    const { error, value } = getFarmByImageSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const imageUrl = value.imageurl;
    console.log('image url printing:', imageUrl);

    // 2️⃣ Search for farm with matching image in the array
    const farm = await Farm.findOne({
      images: imageUrl,
      isActive: true,
      isApproved: true
    })
      .populate('farmCategory', '_id name')  // ✅ Only fetch _id and name
      .populate('facilities', '_id name');   // ✅ Only fetch _id and name

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'No farm found with the provided image URL.'
      });
    }

    // 3️⃣ Respond with populated farm
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

exports.FilterQueeryFarms = async (req, res) => {
  try {
    const cleanedBody = cleanInput(req.body);
    const { error, value } = FilterQueeryFarm.validate(cleanedBody);

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
      page = 1,
      limit = 10
    } = value;

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.toISOString().split('T')[0]);
    const end = endDate
      ? new Date(endDate)
      : new Date(new Date(start).setDate(start.getDate() + 7));

    const allDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(new Date(d).toISOString().split('T')[0]);
    }

    const baseQuery = { isActive: true, isApproved: true };
    if (farmCategory.length > 0) {
      baseQuery.farmCategory = { $in: farmCategory };
    }

    let farms = await Farm.find(baseQuery)
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name');

    if (!farms.length) {
      return res.status(200).json({
        success: false,
        message: 'No farms found for the selected farm categories.'
      });
    }

    if (capacityRange) {
      const { min: capMin, max: capMax } = capacityRange;
      farms = farms.filter(f => f.capacity >= capMin && f.capacity <= capMax);
      if (!farms.length) {
        return res.status(200).json({
          success: false,
          message: `No farms found in the capacity range ${capMin}–${capMax}.`
        });
      }
    }

    if (facilities.length > 0) {
      farms = farms.filter(farm =>
        farm.facilities.some(f => facilities.includes(f._id.toString()))
      );
      if (!farms.length) {
        return res.status(200).json({
          success: false,
          message: 'No farms found with any of the selected facilities.'
        });
      }
    }

    if (priceRange) {
      const { min: priceMin, max: priceMax } = priceRange;

      farms = farms.filter(farm => {
        let isWithinRange = false;

        for (const dateStr of allDates) {
          const dailyEntry = farm.dailyPricing?.find(
            d => new Date(d.date).toISOString().split('T')[0] === dateStr
          );

          const slotPrices = dailyEntry?.slots || farm.defaultPricing || {};

          const prices = [
            slotPrices.full_day,
            slotPrices.day_slot,
            slotPrices.night_slot
          ];

          if (
            prices.some(
              p => typeof p === 'number' && p >= priceMin && p <= priceMax
            )
          ) {
            isWithinRange = true;
            break;
          }
        }

        return isWithinRange;
      });

      if (!farms.length) {
        return res.status(200).json({
          success: false,
          message: `No farms found in the price range ₹${priceMin}–₹${priceMax}.`
        });
      }
    }

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

    const allModes = ['full_day', 'day_slot', 'night_slot'];

    const availableFarms = farms.filter(farm => {
      const blockedDates = (farm.unavailableDates || []).map(d =>
        new Date(d).toISOString().split('T')[0]
      );
      const fid = farm._id.toString();

      for (const date of allDates) {
        if (blockedDates.includes(date)) return false;
        const bookedModes = bookingMap[fid]?.[date] || new Set();
        if (allModes.every(mode => bookedModes.has(mode))) return false;
      }

      return true;
    });

    if (!availableFarms.length) {
      return res.status(200).json({
        success: false,
        message: `No farms fully available between ${start.toDateString()} and ${end.toDateString()}.`
      });
    }

    const skip = (page - 1) * limit;
    const paginatedFarms = availableFarms.slice(skip, skip + limit);
for (let i = 0; i < paginatedFarms.length; i++) {
  const farm = paginatedFarms[i];

  const farmObj = farm.toObject(); // <-- this is the key

  if (Array.isArray(farmObj.dailyPricing)) {
    farmObj.dailyPricing = farmObj.dailyPricing.map(entry => {
      const dateObj = new Date(entry.date);
      const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });

      // console.log("day Name printing", dayName);

      return {
        ...entry,
        dayName
      };
    });
  }

  paginatedFarms[i] = farmObj; // <-- reassign the modified object
}

    return res.status(200).json({
      success: true,
      message: `${availableFarms.length} farm(s) available from ${start.toDateString()} to ${end.toDateString()}.`,
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

// gallary api

exports.getFarmCategories = async (req, res) => {
  try {
    // Optional: validate query if needed
    const { error } = getCategoriesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 1️⃣ Get distinct farmCategory IDs from Farm collection
    const categoryIds = await Farm.distinct('farmCategory');

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
    const { error } = getFacilitiesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // 1️⃣ Fetch used facility IDs
    const facilityIds = await Farm.distinct('facilities', {
      isActive: true,
      isApproved: true
    });

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


exports.getFarmImagesByCategories = async (req, res) => {
  try {
    // ✅ Validate route param (categoryId)
    console.log("req.parms priting",req.params)
    const { error, value } = getImagesByFarmTypeSchema.validate(req.params);
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
      'images'
    );

    if (!farms.length) {
      return res.status(404).json({
        success: false,
        message: 'No farms found for this category.'
      });
    }

    // ✅ Extract and flatten all image URLs
    const allImages = farms.flatMap(farm => farm.images || []);

    if (!allImages.length) {
      return res.status(404).json({
        success: false,
        message: 'No images found for farms of this category.'
      });
    }

    res.status(200).json({
      success: true,
      message: `${allImages.length} image(s) found for this category.`,
      data: allImages
    });

  } catch (err) {
    console.error('[GetFarmImagesByCategory Error]', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


// get all farms 
// currently not in use 

// exports.getAllFarms = async (req, res) => {
//   try {
//     // 1️⃣ Find farms with active + approved status
//     const farms = await Farm.find({
//       isActive: true,
//       isApproved: true
//     })
//       .populate('farmCategory', '_id name')
//       .populate('facilities', '_id name');

//     // 2️⃣ Handle no farms case
//     if (!farms || farms.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'No farms found.'
//       });
//     }

//     // 3️⃣ Respond with data
//     return res.status(200).json({
//       success: true,
//       message: 'Farms fetched successfully.',
//       data: farms
//     });
//   } catch (err) {
//     console.error('[GetAllFarms Error]', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error. Please try again later.'
//     });
//   }
// };





