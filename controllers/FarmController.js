// controllers/booking.controller.js
const FarmBooking = require('../models/FarmBookingModel');
const { monthYearSchema ,farmAddValidationSchema,farmBookingValidationSchema} = require('../validationJoi/FarmValidation');
const Farm = require('../models/FarmModel');
const Vendor=require("../models/VendorModel");
const { uploadFilesToCloudinary } = require('../utils/UploadFile');



exports.addFarm = async (req, res) => {
  try {
    // 1️⃣ Validate body (except owner & images)
    const { error, value } = farmAddValidationSchema.validate(req.body, { abortEarly: false });
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
    // ✅ Validate incoming data
    const { error, value } = farmBookingValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { customerName, customerPhone, customerEmail, customer, farm, date, bookingModes } = value;

    // ✅ Check if farm exists
    const farmDoc = await Farm.findById(farm);
    if (!farmDoc) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // ✅ Conflict Check: for each bookingMode, ensure no existing booking
    const existing = await FarmBooking.find({
      farm,
      date: new Date(date),
      bookingModes: { $in: bookingModes },
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Farm already booked for the selected mode(s) on this date.',
        conflict: existing.map(b => b.bookingModes).flat()
      });
    }

    // ✅ Proceed to book
    const booking = new FarmBooking({
      customerName,
      customerPhone,
      customerEmail,
      customer,
      farm,
      farmType: farmDoc.type,
      date,
      bookingModes,
      status: value.status || 'pending',
      paymentStatus: value.paymentStatus || 'unpaid'
    });

    await booking.save();

    res.status(201).json({
      message: 'Farm booked successfully!',
      data: booking
    });

  } catch (err) {
    console.error('[FarmBooking Error]', err);
    res.status(500).json({ error: 'Server error. Try again later.' });
  }
};



exports.getMonthlyFarmBookings = async (req, res) => {
  try {
    // 🔐 Validate monthYear using Joi
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

    const bookings = await FarmBooking.find({
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    }).populate('farm', 'name');

    const grouped = {};

    bookings.forEach(b => {
      const key = `${b.farm._id}-${b.date.toISOString().split('T')[0]}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: b.date.toISOString().split('T')[0],
          farmId: b.farm._id,
          farmName: b.farm.name,
          bookedModes: new Set()
        };
      }
      b.bookingModes.forEach(mode => grouped[key].bookedModes.add(mode));
    });

    const fullBookingModes = ['full_day', 'day_slot', 'night_slot'];

    const response = Object.values(grouped).map(entry => {
      const booked = Array.from(entry.bookedModes);
      const isFull = fullBookingModes.every(mode => booked.includes(mode));

      return {
        date: entry.date,
        farmId: entry.farmId,
        farmName: entry.farmName,
        status: isFull ? 'full' : 'partial',
        bookedModes: booked,
        availableModes: fullBookingModes.filter(m => !booked.includes(m))
      };
    });

    res.json(response);
  } catch (err) {
    console.error('Calendar booking fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};





