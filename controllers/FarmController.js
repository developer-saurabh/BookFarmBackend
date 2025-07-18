// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const FarmCategory = require("../models/FarmCategory")
const Facility = require("../models/FarmFacility")
const { monthYearSchema, farmAddValidationSchema, blockDateSchema, farmBookingValidationSchema, FilterQueeryHomePageScheam, getCategoriesSchema, getFarmByIdSchema, getFarmByImageSchema, FilterQueeryFarm, getImagesByFarmTypeSchema, unblockDateSchema } = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Customer = require("../models/CustomerModel")
const Vendor = require("../models/VendorModel");
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const mongoose = require("mongoose")
const { DateTime } = require('luxon'); // optional: for clean date handling (recommended)
exports.addFarm = async (req, res) => {
  try {
    const { error, value } = farmAddValidationSchema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(err => err.message)
      });
    }

    const ownerId = req.user.id;
    value.owner = ownerId;

    const vendor = await Vendor.findById(ownerId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    if (!vendor.isVerified || !vendor.isActive || vendor.isBlocked) {
      return res.status(403).json({ error: 'Vendor is not eligible to add farms.' });
    }

    const existingFarm = await Farm.findOne({ name: value.name, owner: ownerId });
    if (existingFarm) {
      return res.status(409).json({ error: 'A farm with this name already exists.' });
    }

    if (!Array.isArray(value.farmCategory) || value.farmCategory.length === 0) {
      return res.status(400).json({ error: 'At least one farm category must be selected.' });
    }

    const validFarmCategories = await FarmCategory.find({
      _id: { $in: value.farmCategory }
    });

    if (validFarmCategories.length !== value.farmCategory.length) {
      return res.status(400).json({ error: 'Invalid farm category selected.' });
    }

    if (value.facilities && Array.isArray(value.facilities) && value.facilities.length > 0) {
      const validFacilities = await Facility.find({
        _id: { $in: value.facilities }
      });

      if (validFacilities.length !== value.facilities.length) {
        return res.status(400).json({ error: 'One or more selected facilities are invalid.' });
      }
    }

    const uploaded = req.files?.images || req.files?.image;
    if (!uploaded) {
      return res.status(400).json({ error: 'At least one image must be uploaded.' });
    }

    const imagesArray = Array.isArray(uploaded) ? uploaded : [uploaded];
    const cloudUrls = await uploadFilesToCloudinary(imagesArray, 'farms');
    value.images = cloudUrls;

    const newFarm = await new Farm(value).save();

    // ✅ Populate references
    const populatedFarm = await Farm.findById(newFarm._id)
      .populate('farmCategory')
      .populate('facilities');

    return res.status(201).json({
      message: 'Farm added successfully',
      data: populatedFarm
    });

  } catch (err) {
    console.error('[AddFarm Error]', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

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

    // ✅ Step 4: Calculate totalPrice + breakdown
    const priceBreakdown = {};
    let totalPrice = 0;

    for (let mode of bookingModes) {
      const modePrice = farmDoc.pricing?.[mode];
      if (typeof modePrice !== 'number') {
        return res.status(400).json({
          error: `Pricing not configured for mode "${mode}" on this farm.`
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
    })
      .populate('owner', 'name')              // populate owner name
      .populate('facilities', 'name')         // populate facilities names
      .populate('farmCategory', 'name');      // populate farmCategory names


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
    const { error, value } = getFarmByIdSchema.validate({ farmId: req.params.id });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const farm = await Farm.findById(value.farmId);

    if (!farm || !farm.isActive || !farm.isApproved) {
      return res.status(404).json({
        success: false,
        message: 'Farm not found or inactive/unapproved.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Farm fetched successfully.',
      data: farm
    });
  } catch (err) {
    console.error('[GetFarmById Error]', err);
    res.status(500).json({
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

// farms filter api

exports.FilterQueeryFarms = async (req, res) => {
  try {
    const { error, value } = FilterQueeryFarm.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { date, farmCategory, capacityRange, priceRange, facilities = [] } = value;
    const { min: capMin, max: capMax } = capacityRange;
    const { min: priceMin, max: priceMax } = priceRange;

    // 1️⃣ Fetch base farms by category
    const farms = await Farm.find({
      farmCategory: { $in: farmCategory },
      isActive: true,
      isApproved: true
    })
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name');

    if (!farms.length) {
      return res.status(404).json({
        success: false,
        message: `No farms found for the selected category.`
      });
    }

    let filtered = farms;

    // 2️⃣ Capacity filter
    filtered = filtered.filter(f => f.capacity >= capMin && f.capacity <= capMax);
    if (!filtered.length) {
      return res.status(404).json({
        success: false,
        message: `No farms found in capacity range ${capMin}–${capMax}.`
      });
    }

    // 3️⃣ Facility filter
    if (facilities.length > 0) {
      filtered = filtered.filter(farm =>
        facilities.every(fid =>
          farm.facilities.some(f => f._id.toString() === fid)
        )
      );
      if (!filtered.length) {
        return res.status(404).json({
          success: false,
          message: `No farms found with selected facilities.`
        });
      }
    }

    // 4️⃣ Price range filter
    filtered = filtered.filter(f => {
      const prices = [
        f.pricing?.full_day,
        f.pricing?.day_slot,
        f.pricing?.night_slot
      ];
      return prices.some(p => typeof p === 'number' && p >= priceMin && p <= priceMax);
    });

    if (!filtered.length) {
      return res.status(404).json({
        success: false,
        message: `No farms found in price range ₹${priceMin}–₹${priceMax}.`
      });
    }

    // 5️⃣ Availability filter with block-date logic
    if (date) {
      const isoDateStr = new Date(date).toISOString().split('T')[0];
      const start = new Date(`${isoDateStr}T00:00:00.000Z`);
      const end = new Date(`${isoDateStr}T23:59:59.999Z`);

      // 5.1 Exclude vendor-blocked farms
      filtered = filtered.filter(farm => {
        const blockedDates = (farm.unavailableDates || []).map(d =>
          new Date(d).toISOString().split('T')[0]
        );
        return !blockedDates.includes(isoDateStr);
      });

      if (!filtered.length) {
        return res.status(404).json({
          success: false,
          message: `All matching farms are blocked by vendors on ${isoDateStr}.`
        });
      }

      // 5.2 Filter fully booked farms
      const farmIds = filtered.map(f => f._id);
      const bookings = await FarmBooking.find({
        farm: { $in: farmIds },
        date: { $gte: start, $lte: end },
        status: { $in: ['pending', 'confirmed'] }
      });

      const bookingMap = {};
      bookings.forEach(b => {
        const fid = b.farm.toString();
        if (!bookingMap[fid]) bookingMap[fid] = new Set();
        b.bookingModes.forEach(mode => bookingMap[fid].add(mode));
      });

      const allModes = ['full_day', 'day_slot', 'night_slot'];
      filtered = filtered.filter(f => {
        const booked = bookingMap[f._id.toString()] || new Set();
        return !allModes.every(mode => booked.has(mode));
      });

      if (!filtered.length) {
        return res.status(404).json({
          success: false,
          message: `All matching farms are fully booked on ${isoDateStr}.`
        });
      }
    }

    // ✅ Return available farms
    return res.status(200).json({
      success: true,
      message: `${filtered.length} farm(s) found matching your filters.`,
      data: filtered
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

exports.getFarmImagesByCategories = async (req, res) => {
  try {
    // ✅ Validate route param (categoryId)
    console.log("req.parms priting", req.params)
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

exports.getAllFarms = async (req, res) => {
  try {
    // 1️⃣ Find farms with active + approved status
    const farms = await Farm.find({
      isActive: true,
      isApproved: true
    })
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name');

    // 2️⃣ Handle no farms case
    if (!farms || farms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No farms found.'
      });
    }

    // 3️⃣ Respond with data
    return res.status(200).json({
      success: true,
      message: 'Farms fetched successfully.',
      data: farms
    });
  } catch (err) {
    console.error('[GetAllFarms Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


