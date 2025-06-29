// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const { monthYearSchema, farmAddValidationSchema, farmBookingValidationSchema, FilterQueeryHomePageScheam, getCategoriesSchema, getFarmByIdSchema, getFarmByImageSchema } = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Vendor = require("../models/VendorModel");
const { uploadFilesToCloudinary } = require('../utils/UploadFile');



exports.addFarm = async (req, res) => {
  try {
    // 1️⃣ Validate body (except owner & images)
    const { error, value } = farmAddValidationSchema.validate(req.body, { abortEarly: false });
    // console.log("values printing",value)
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(err => err.message)
      });
    }

    // 2️⃣ Inject owner from authenticated user
    const ownerId = req.user.id;
    value.owner = ownerId;

    // 3️⃣ Fetch and validate vendor
    const vendor = await Vendor.findById(ownerId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });

    if (!vendor.isVerified)
      return res.status(403).json({ error: 'Vendor is not verified to add venues.' });

    if (!vendor.isActive)
      return res.status(403).json({ error: 'Vendor is not active to add venues.' });

    if (vendor.isBlocked)
      return res.status(403).json({ error: 'Vendor is blocked and cannot add venues.' });

    // 4️⃣ Check for duplicate farm name for this vendor
    const existingFarm = await Farm.findOne({ name: value.name, owner: ownerId });
    if (existingFarm) {
      return res.status(409).json({ error: 'A farm with this name already exists for this vendor.' });
    }

    // 5️⃣ Validate and normalize uploaded images
    const uploaded = req.files?.images || req.files?.image;
    if (!uploaded) {
      return res.status(400).json({ error: 'At least one image must be uploaded.' });
    }

    const imagesArray = Array.isArray(uploaded) ? uploaded : [uploaded];

    // 6️⃣ Upload to cloud and get URLs
    const cloudUrls = await uploadFilesToCloudinary(imagesArray, 'farms');
    value.images = cloudUrls;

    // 7️⃣ Save to DB
    // console.log("value printing befor saving",value)
    const newFarm = new Farm(value);
    await newFarm.save();

    res.status(201).json({
      message: 'Farm added successfully',
      data: newFarm
    });
  } catch (err) {
    console.error('[AddFarm Error]', err);
    res.status(500).json({ message: 'Server error. Try again later.' });
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

    const farmDoc = await Farm.findById(farm_id);
    console.log("farm doc printing",farmDoc)
    if (!farmDoc) {
      return res.status(404).json({ error: 'Farm not found' });
    }

   const existing = await FarmBooking.find({
  farm: farm_id,
      date: new Date(date),
      bookingModes: { $in: bookingModes },
      status: { $in: ['pending', 'confirmed'] }
    });
if (existing.length > 0) {
  const conflictModes = [...new Set(existing.flatMap(b => b.bookingModes))]; // unique slot list

  return res.status(409).json({
    error: `Farm already booked for the following slot(s) on ${new Date(date).toISOString().split('T')[0]}: ${conflictModes.join(', ')}`,
    conflict: conflictModes
  });
}
    // ✅ Step: Calculate totalPrice + breakdown
   const priceBreakdown = {};
let totalPrice = 0;

for (let mode of bookingModes) {
  console.log("mode printing", mode);
  const modePrice = farmDoc.pricing?.[mode]; // ✅ fixed
  if (typeof modePrice !== 'number') {
    return res.status(400).json({
      error: `Pricing not configured for mode "${mode}" on this farm.`
    });
  }
  priceBreakdown[mode] = modePrice;
  totalPrice += modePrice;
}
console.log("toal price printing",)
    const booking = new FarmBooking({
      customerName,
      customerPhone,
      customerEmail,
      customer,
      farm: farm_id,

      farmType: farmDoc.farmType,
      date,
      bookingModes,
      status: value.status || 'pending',
      paymentStatus: value.paymentStatus || 'unpaid',
      totalPrice, // 💸
      priceBreakdown // 📊
    });

    await booking.save();
    const plainBooking = booking.toObject();
plainBooking.priceBreakdown = Object.fromEntries(booking.priceBreakdown);

  console.log("final response printing",booking)
res.status(201).json({
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

//front page apis

// for calender 
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

    // ✅ Get all active farms
    const farms = await Farm.find({ isActive: true, isApproved: true });
    const farmIds = farms.map(f => f._id.toString());

    // ✅ Fetch all bookings for the month
    const bookings = await FarmBooking.find({
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    });

    // ✅ Build a booking map: { date: { farmId: Set of booked modes } }
    const bookingMap = {}; // e.g. { '2025-07-01': { farmId1: Set(), farmId2: Set() } }

    bookings.forEach(b => {
      const dayKey = b.date.toISOString().split('T')[0];
      if (!bookingMap[dayKey]) bookingMap[dayKey] = {};

      if (!bookingMap[dayKey][b.farm]) {
        bookingMap[dayKey][b.farm] = new Set();
      }

      b.bookingModes.forEach(mode => bookingMap[dayKey][b.farm].add(mode));
    });

    // ✅ Final calendar result
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
      const dayBookings = bookingMap[dateStr] || {};

      let fullyBookedCount = 0;
      let partialAvailable = false;
      let hasCompletelyFreeFarm = false;

      for (const farmId of farmIds) {
        const bookedModes = dayBookings[farmId] || new Set();

        if (bookedModes.size === 0) {
          hasCompletelyFreeFarm = true;
          break; // no need to check more if even one is fully free
        } else if (bookedModes.size < 3) {
          partialAvailable = true;
        } else {
          fullyBookedCount++;
        }
      }

      const allFullyBooked = fullyBookedCount === farmIds.length;

      result.push({
        date: dateStr,
        Full_available: hasCompletelyFreeFarm,
        partial_Available: !hasCompletelyFreeFarm && partialAvailable
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Calendar booking fetch error:', err);
    res.status(500).json({ message: 'Server error' });
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
        message: error.details[0].message
      });
    }

    const { date, category, capacityRange } = value;
    const { min, max } = capacityRange;

    const targetDate = new Date(date);
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

    // ✅ Step 1: Filter farms by category
    const categoryFarms = await Farm.find({ farmType: category });
    if (!categoryFarms || categoryFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No farms found under the category "${category}".`
      });
    }

    // ✅ Step 2: Filter farms in capacity range
    const capacityFilteredFarms = categoryFarms.filter(f =>
      f.capacity >= min && f.capacity <= max
    );

    if (capacityFilteredFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No farms under category "${category}" found in capacity range ${min}–${max}.`
      });
    }

    const farmIds = capacityFilteredFarms.map(f => f._id);

    // ✅ Step 3: Get bookings per farm with mode aggregation
    const bookings = await FarmBooking.find({
      farm: { $in: farmIds },
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] }
    });

    // ✅ Step 4: Build a map: farmId => Set of booked modes
    const bookingMap = {}; // { farmId: Set(['full_day', 'night_slot']) }

    bookings.forEach(b => {
      const farmId = b.farm.toString();
      if (!bookingMap[farmId]) {
        bookingMap[farmId] = new Set();
      }
      b.bookingModes.forEach(mode => bookingMap[farmId].add(mode));
    });

    // ✅ Step 5: Filter farms that are NOT fully booked (all 3 slots)
    const allModes = ['full_day', 'day_slot', 'night_slot'];

    const availableFarms = capacityFilteredFarms.filter(farm => {
      const bookedModes = bookingMap[farm._id.toString()] || new Set();
      return !allModes.every(mode => bookedModes.has(mode));
    });

    // ✅ Step 6: Respond
    if (availableFarms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `All farms under category "${category}" with capacity in range ${min}–${max} are fully booked on ${date}.`
      });
    }

    res.status(200).json({
      success: true,
      message: `${availableFarms.length} farm(s) available on ${date}.`,
      data: availableFarms
    });
  } catch (err) {
    console.error('Farm filter query error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};




exports.getFarmCategories = async (req, res) => {
  try {
    // ✅ Validate query (no params expected)
    const { error } = getCategoriesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // ✅ Fetch distinct farmType values from DB
    const categories = await Farm.distinct('farmType');

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No farm categories found in the system.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Farm categories fetched successfully.',
      data: categories.sort()
    });
  } catch (err) {
    console.error('Category fetch error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.getAllFarms = async (req, res) => {
  try {
    const farms = await Farm.find({ isActive: true, isApproved: true });

    if (!farms || farms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No farms found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Farms fetched successfully.',
      data: farms
    });
  } catch (err) {
    console.error('[GetAllFarms Error]', err);
    res.status(500).json({
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
    const { error, value } = getFarmByImageSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { imageUrl } = value;

    // 2️⃣ Search for farm with image URL in the images array
    const farm = await Farm.findOne({
      images: imageUrl,
      isActive: true,
      isApproved: true
    });

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'No farm found with the provided image URL.'
      });
    }

    // 3️⃣ Success
    res.status(200).json({
      success: true,
      message: 'Farm found successfully.',
      data: farm
    });
  } catch (err) {
    console.error('[GetFarmByImageUrl Error]', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};



