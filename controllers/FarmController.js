// controllers/booking.controller.js
const FarmBooking = require('../models/farmBooking.model');
const { monthYearSchema } = require('../validators/booking.validator');

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

