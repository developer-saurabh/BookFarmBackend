const RapidBooking = require('../models/RapidBookingModel');
const Farm = require('../models/FarmModel');
const { rapidBookingSchema } = require('../validationJoi/RapidBookingValidation');

exports.submitRapidBooking = async (req, res) => {
  try {
    // ✅ Joi validation
    const { error, value } = rapidBookingSchema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      farm,
      requestedDate,
      bookingModes,
      notes
    } = value;

    // ✅ Check if farm exists
    const farmExists = await Farm.findById(farm);
    if (!farmExists) {
      return res.status(404).json({
        success: false,
        message: 'The selected farm does not exist.'
      });
    }

    // ✅ Normalize date to day-precision string for safe duplicate check
    const isoDateStr = new Date(requestedDate).toISOString().split('T')[0];

    // ✅ Check for duplicate rapid request (same farm, phone, date)
    const existing = await RapidBooking.findOne({
      farm,
      customerPhone,
      requestedDate: {
        $gte: new Date(`${isoDateStr}T00:00:00.000Z`),
        $lte: new Date(`${isoDateStr}T23:59:59.999Z`)
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You have already submitted a rapid booking request for this farm on ${isoDateStr}.`,
        existingRequestId: existing._id
      });
    }

    // ✅ Save new request
    const rapidBooking = new RapidBooking({
      customerName,
      customerPhone,
      customerEmail,
      farm,
      requestedDate,
      bookingModes,
      notes
    });

    await rapidBooking.save();

    return res.status(201).json({
      success: true,
      message: 'Rapid booking request submitted successfully.',
      data: rapidBooking
    });

  } catch (err) {
    console.error('Rapid Booking Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};
