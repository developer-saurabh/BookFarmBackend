// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const FarmCategory=require("../models/FarmCategory")
const Facility=require("../models/FarmFacility")
const { monthYearSchema, farmAddValidationSchema, farmBookingValidationSchema, FilterQueeryHomePageScheam, getCategoriesSchema, getFarmByIdSchema, getFarmByImageSchema, FilterQueeryFarm, getImagesByFarmTypeSchema } = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Customer=require("../models/CustomerModel")
const Vendor = require("../models/VendorModel");
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const mongoose=require("mongoose")

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
let customerId = customer; // fallback in case it's already provided in request

if (!customerId) {
  // Try to find by phone or email
  let existingCustomer = await Customer.findOne({
    $or: [
      { phone: customerPhone },
      { email: customerEmail }
    ]
  });

  // If not found, create new
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

console.log("toal price printing",)
   const booking = new FarmBooking({
  customerName,
  customerPhone,
  customerEmail,
  customer: customerId,
  farm: farm_id,
  farmType: farmDoc.farmType,
  date,
  bookingModes,
  status: value.status || 'pending',
  paymentStatus: value.paymentStatus || 'unpaid',
  totalPrice,
  priceBreakdown
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

    console.log("value printing filter query farm", value);

    const { date, farmCategory, capacityRange, priceRange, facilities = [] } = value;
    const { min: capMin, max: capMax } = capacityRange;
    const { min: priceMin, max: priceMax } = priceRange;

    // 1️⃣ Base farm query
    const farms = await Farm.find({
      farmCategory: { $in: farmCategory }, // farmCategory is already an array
      isActive: true,
      isApproved: true
    })
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name');

    console.log("farm printing", farms);

    if (!farms.length) {
      return res.status(404).json({
        success: false,
        message: `No farms found for the selected category.`
      });
    }

    let filtered = farms;

    // 2️⃣ Capacity range filter
    filtered = filtered.filter(f => f.capacity >= capMin && f.capacity <= capMax);
    if (!filtered.length) {
      return res.status(404).json({
        success: false,
        message: `No farms found in capacity range ${capMin}–${capMax}.`
      });
    }

    // 3️⃣ Facilities filter (with populated facilities)
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

    // 4️⃣ Price range filter (match any pricing slot)
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

    // 5️⃣ Date availability check
    if (date) {
      const start = new Date(new Date(date).setHours(0, 0, 0, 0));
      const end = new Date(new Date(date).setHours(23, 59, 59, 999));

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
          message: `No farms available for selected date (${date}).`
        });
      }
    }

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


