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


exports.bookFarm = async (req, res) => {
  try {
    const { error, value } = FarmValidation.farmBookingValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { customerName, customerPhone, customerEmail, customer, farm_id, date, bookingModes, Guest_Count, Group_Category } = value;
    const normalizedDate = new Date(date);
    const isoDateStr = normalizedDate.toISOString().split('T')[0];

    // ✅ Step 1: Find farm
    const farmDoc = await Farm.findById(farm_id);
    if (!farmDoc) {
      return res.status(404).json({ error: 'Farm not found' });
    }
if (Guest_Count > farmDoc.capacity) {
  return res.status(400).json({
    error: `Guest count (${Guest_Count}) exceeds the farm's capacity (${farmDoc.capacity}). Please reduce the number of guests or choose another farm.`
  });
}
 // ✅ Step 2: Block-date & slot check (NEW LOGIC)
const blockedEntry = (farmDoc.unavailableDates || []).find(d => {
  if (!d.date) return false;
  const storedISO = new Date(d.date).toISOString().split("T")[0];
  return storedISO === isoDateStr;
});

if (blockedEntry) {
  const blockedSlots = blockedEntry.blockedSlots || ["full_day"];

  // 🔹 If full_day is blocked → entire date is blocked
  if (blockedSlots.includes("full_day")) {
    return res.status(403).json({
      error: `This farm is fully blocked on ${isoDateStr}. No bookings allowed.`
    });
  }

  // 🔹 If requested slot is blocked → deny booking
  const blockedConflict = bookingModes.filter(mode => blockedSlots.includes(mode));
  if (blockedConflict.length > 0) {
    return res.status(403).json({
      error: `The following slot(s) are blocked on ${isoDateStr}: ${blockedConflict.join(", ")} By Venodor`,
      conflict: blockedConflict
    });
  }
}


    // ✅ Step 3: Validate slot combination (real world)
    if (bookingModes.includes('full_day') && bookingModes.length > 1) {
      return res.status(400).json({
        error: `Invalid booking request. 'full_day' cannot be combined with other slots.`,
        message: `Invalid booking request. 'full_day' cannot be combined with other slots.`
      });
    }

    // ✅ Step 4: Check for existing bookings on this date
    const existingBookings = await FarmBooking.find({
      farm: farm_id,
      date: normalizedDate,
      status: { $in: ['pending', 'confirmed'] }
    });

    const existingModes = existingBookings.flatMap(b => b.bookingModes);

    // ✅ Step 4A: Full-day <-> slot conflict rule
    if (bookingModes.includes('full_day') && existingBookings.length > 0) {
      return res.status(409).json({
        error: `Farm already has slot bookings on ${isoDateStr}, so full day booking is not allowed.`,
        conflict: existingModes
      });
    }

    if ((bookingModes.includes('day_slot') || bookingModes.includes('night_slot')) &&
        existingModes.includes('full_day')) {
      return res.status(409).json({
        error: `Farm is already booked for full day on ${isoDateStr}, so individual slot bookings are not allowed.`,
        conflict: ['full_day']
      });
    }

    // ✅ Step 4B: Existing mode conflicts for same modes
    const conflicting = existingBookings.filter(b =>
      b.bookingModes.some(mode => bookingModes.includes(mode))
    );
    if (conflicting.length > 0) {
      const conflictModes = [...new Set(conflicting.flatMap(b => b.bookingModes))];
      return res.status(409).json({
        error: `Farm already booked for the following slot(s) on ${isoDateStr}: ${conflictModes.join(', ')}`,
        conflict: conflictModes
      });
    }

    // ✅ Step 5: Calculate totalPrice + breakdown
    const priceBreakdown = {};
    let totalPrice = 0;

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

    // ✅ Step 6: Resolve customer
    let customerId = customer;
    if (!customerId) {
      let existingCustomer = await Customer.findOne({
        $or: [{ phone: customerPhone }, { email: customerEmail }]
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

    // ✅ Step 7: Generate random 6-digit booking ID
const generateBookingId = () => Math.floor(100000 + Math.random() * 900000);

    // ✅ Step 7: Save booking
  const booking = new FarmBooking({
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
  status: value.status || 'pending',
  paymentStatus: value.paymentStatus || 'unpaid',
  totalPrice,
  priceBreakdown,
  farmSnapshot: {
    name: farmDoc.name,
    location: {
      address: farmDoc.location.address,
      city: farmDoc.location.city,
      state: farmDoc.location.state,
      pinCode: farmDoc.location.pinCode,
      areaName: farmDoc.location.areaName
    }
  }
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

// exports.getFarmById = async (req, res) => {
//   try {
//     const { error, value } = FarmValidation.getFarmByIdSchema.validate({ farmId: req.body.farmId });

//     if (error) {
//       return res.status(400).json({
//         success: false,
//         message: error.details[0].message
//       });
//     }

//     // 🔍 Get the farm with populated refs
//     const farm = await Farm.findById(value.farmId)
//       .populate('farmCategory', '_id name')
//       .populate('facilities', '_id name icon')
//       .populate('owner', '_id name email phone');

//     if (!farm || !farm.isActive || !farm.isApproved) {
//       return res.status(404).json({
//         success: false,
//         message: 'Farm not found or inactive/unapproved.'
//       });
//     }

//     // 📅 Get next 7 days (from today)
//     const today = moment().startOf('day');
//     const next30Days = [];
//   for (let i = 0; i < 30; i++) {
//   next30Days.push(today.clone().add(i, 'days'));
// }

//     // 🛑 Remove unavailableDates
//     const blockedDates = (farm.unavailableDates || []).map(date =>
//       moment(date).format('YYYY-MM-DD')
//     );

//     // 📦 Fetch bookings for this farm in the next 7 days
//  const bookings = await FarmBooking.find({
//   farm: farm._id,
//   date: {
//     $gte: today.toDate(),
//     $lte: today.clone().add(29, 'days').endOf('day').toDate() // ✅ 30 days window
//   },
//   status: { $in: ['pending', 'confirmed'] }
// });

//     // 📊 Create map of booked modes by date
//     const bookingMap = {};
//     bookings.forEach(booking => {
//       const dateStr = moment(booking.date).format('YYYY-MM-DD');
//       if (!bookingMap[dateStr]) bookingMap[dateStr] = new Set();
//       booking.bookingModes.forEach(mode => bookingMap[dateStr].add(mode));
//     });

//     const allModes = ['full_day', 'day_slot', 'night_slot'];

//     // ✅ Build availability array with day name
//  // ✅ Build availability array with day name
// const availability = next30Days.map(dayMoment => {
//   const dateStr = dayMoment.format('YYYY-MM-DD');
//   const dayName = dayMoment.format('dddd');
//   const isBlocked = blockedDates.includes(dateStr);
//   const booked = bookingMap[dateStr] || new Set();

//   const slots = {};
//   console.log('is blocked printing,',isBlocked)
//   // 🔹 Step 1: If date is blocked → all modes false
//   if (isBlocked) {
//     allModes.forEach(mode => slots[mode] = false);
//   } else {
//     // 🔹 Step 2: If full_day booked → all false
//     if (booked.has('full_day')) {
//       allModes.forEach(mode => slots[mode] = false);
//     } 
//     // 🔹 Step 3: If day_slot/night_slot booked → those false & full_day false
//     else {
//       allModes.forEach(mode => {
//         if ((booked.has('day_slot') || booked.has('night_slot')) && mode === 'full_day') {
//           slots[mode] = false;
//         } else {
//           slots[mode] = !booked.has(mode);
//         }
//       });
//     }
//   }

//   return {
//     date: dateStr,
//     dayName,
//     availableSlots: slots
//   };
// });
//     // ✅ Convert dailyPricing checkIn/checkOut to AM/PM
//     const farmObj = farm.toObject();
//     if (farmObj.dailyPricing && Array.isArray(farmObj.dailyPricing)) {
//       farmObj.dailyPricing = farmObj.dailyPricing.map(dp => ({
//         ...dp,
//         checkIn: dp.checkIn ? moment(dp.checkIn, 'HH:mm').format('hh:mm A') : '10:00 AM',
//         checkOut: dp.checkOut ? moment(dp.checkOut, 'HH:mm').format('hh:mm A') : '06:00 PM'
//       }));
//     }

//     // ✅ Response
//     return res.status(200).json({
//       success: true,
//       message: 'Farm fetched successfully.',
//       data: {
//         ...farmObj,
//         availability
//       }
//     });

//   } catch (err) {
//     console.error('[GetFarmById Error]', err);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error. Please try again later.'
//     });
//   }
// };



exports.getFarmById = async (req, res) => {
  try {
    const { error, value } = FarmValidation.getFarmByIdSchema.validate({ farmId: req.body.farmId });

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

    // 📅 Get next 30 days (from today)
    const today = moment().startOf('day');
    const next30Days = [];
    for (let i = 0; i < 30; i++) {
      next30Days.push(today.clone().add(i, 'days'));
    }

    // 🛑 Create blockedMap: date => blockedSlots
    const blockedMap = {};
    (farm.unavailableDates || []).forEach(entry => {
      const dateStr = moment(entry.date).format('YYYY-MM-DD');
      blockedMap[dateStr] = new Set(entry.blockedSlots || []);
    });

    // 📦 Fetch bookings for this farm in the next 30 days
    const bookings = await FarmBooking.find({
      farm: farm._id,
      date: {
        $gte: today.toDate(),
        $lte: today.clone().add(29, 'days').endOf('day').toDate()
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

    // ✅ Build availability array with day name and partial block handling
    const availability = next30Days.map(dayMoment => {
      const dateStr = dayMoment.format('YYYY-MM-DD');
      const dayName = dayMoment.format('dddd');

      const booked = bookingMap[dateStr] || new Set();
      const blockedSlots = blockedMap[dateStr] || new Set();

      const slots = {};

      allModes.forEach(mode => {
        // If this slot is blocked or booked → false
        if (blockedSlots.has(mode) || booked.has(mode)) {
          slots[mode] = false;
        }
        // If full_day is blocked/booked → all false
        else if (blockedSlots.has('full_day') || booked.has('full_day')) {
          slots[mode] = false;
        }
        else {
          slots[mode] = true;
        }
      });

      // Extra rule: if day_slot/night_slot blocked/booked → full_day also false
      if (blockedSlots.has('day_slot') || blockedSlots.has('night_slot') ||
          booked.has('day_slot') || booked.has('night_slot')) {
        slots.full_day = false;
      }

      return {
        date: dateStr,
        dayName,
        availableSlots: slots
      };
    });

    // ✅ Convert dailyPricing checkIn/checkOut to AM/PM
    const farmObj = farm.toObject();
    if (farmObj.dailyPricing && Array.isArray(farmObj.dailyPricing)) {
      farmObj.dailyPricing = farmObj.dailyPricing.map(dp => ({
        ...dp,
        checkIn: dp.checkIn ? moment(dp.checkIn, 'HH:mm').format('hh:mm A') : '10:00 AM',
        checkOut: dp.checkOut ? moment(dp.checkOut, 'HH:mm').format('hh:mm A') : '06:00 PM'
      }));
    }

    // ✅ Response
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
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
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

//     const baseQuery = { isActive: true, isApproved: true };
//     if (farmCategory.length > 0) {
//       baseQuery.farmCategory = { $in: farmCategory };
//     }

//     let farms = await Farm.find(baseQuery)
//       .populate('farmCategory', '_id name')
//       .populate('facilities', '_id name');

//     if (!farms.length) {
//       return res.status(200).json({
//         success: false,
//         message: 'No farms found for the selected farm categories.'
//       });
//     }

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

//     if (facilities.length > 0) {
//       farms = farms.filter(farm =>
//         farm.facilities.some(f => facilities.includes(f._id.toString()))
//       );
//       if (!farms.length) {
//         return res.status(200).json({
//           success: false,
//           message: 'No farms found with any of the selected facilities.'
//         });
//       }
//     }

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

//           const slotPrices = dailyEntry?.slots || farm.defaultPricing || {};

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
//         message: `No farms fully available between ${start.toDateString()} and ${end.toDateString()}.`
//       });
//     }

//     const skip = (page - 1) * limit;
//     const paginatedFarms = availableFarms.slice(skip, skip + limit);

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
//       message: `${availableFarms.length} farm(s) available from ${start.toDateString()} to ${end.toDateString()}.`,
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
      types = [],              // 👈 NEW
      page = 1,
      limit = 10
    } = value;

    const now = new Date();

    const start = startDate ? new Date(startDate) : new Date(now.toISOString().split('T')[0]);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid startDate format.' });
    }

    const end = endDate
      ? new Date(endDate)
      : new Date(new Date(start).setDate(start.getDate() + 7));
    if (isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid endDate format.' });
    }

    const allDates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const clone = new Date(d);
      if (!isNaN(clone.getTime())) {
        allDates.push(clone.toISOString().split('T')[0]);
      }
    }

  const baseQuery = {};
if (farmCategory.length > 0) {
  baseQuery.farmCategory = { $in: farmCategory };
}

    let farms = await Farm.find(baseQuery)
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name')
      .populate('Types', '_id name')
      ;

      // console.log("farm printing",farms)

    if (!farms.length) {
      return res.status(200).json({
        success: false,
        message: 'No farms found for the selected farm categories.'
      });
    }

    // 🧮 capacity filter (unchanged)
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

    // 🧩 facilities filter (unchanged)
    if (Array.isArray(facilities) && facilities.length > 0) {
      const facilitySet = new Set(facilities.map(String));
      farms = farms.filter(farm =>
        Array.isArray(farm.facilities) &&
        farm.facilities.some(f => facilitySet.has(String(f._id)))
      );
      if (!farms.length) {
        return res.status(200).json({
          success: false,
          message: 'No farms found with any of the selected facilities.'
        });
      }
    }

    // 🧩 types filter (NEW – mirrors facilities behavior)
    if (Array.isArray(types) && types.length > 0) {
      const typesSet = new Set(types.map(String));
      farms = farms.filter(farm => {
        const assigned = Array.isArray(farm.Types) ? farm.Types : [];
        for (const t of assigned) {
          const tid = t && t._id ? String(t._id) : String(t); // works for ObjectId or populated doc
          if (typesSet.has(tid)) return true; // ANY match
        }
        return false;
      });
      if (!farms.length) {
        return res.status(200).json({
          success: false,
          message: 'No farms found with any of the selected types.'
        });
      }
    }

    // 💰 price filter (unchanged)
    if (priceRange) {
      const { min: priceMin, max: priceMax } = priceRange;

      farms = farms.filter(farm => {
        let isWithinRange = false;

        for (const dateStr of allDates) {
          const dailyEntry = farm.dailyPricing?.find(d => {
            const dt = new Date(d.date);
            return !isNaN(dt.getTime()) &&
              dt.toISOString().split('T')[0] === dateStr;
          });

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

    // 📚 bookings (unchanged)
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
      const blockedDates = (farm.unavailableDates || []).map(d => {
        const dt = new Date(d);
        return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : null;
      }).filter(Boolean);

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

    // 📄 pagination (unchanged)
    const skip = (page - 1) * limit;
    const paginatedFarms = availableFarms.slice(skip, skip + limit);

    // dayName add-on (unchanged)
    for (let i = 0; i < paginatedFarms.length; i++) {
      const farm = paginatedFarms[i];
      const farmObj = farm.toObject();

      if (Array.isArray(farmObj.dailyPricing)) {
        farmObj.dailyPricing = farmObj.dailyPricing.map(entry => {
          const dateObj = new Date(entry.date);
          const isValidDate = !isNaN(dateObj.getTime());

          return {
            ...entry,
            dayName: isValidDate
              ? dateObj.toLocaleDateString('en-IN', { weekday: 'long' })
              : null
          };
        });
      }

      paginatedFarms[i] = farmObj;
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
    let typeIds = await Farm.distinct('Types')

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


