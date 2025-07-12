// models/RapidBooking.js
const mongoose = require('mongoose');

const RapidBookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },
  farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  requestedDate: { type: Date, required: true },
  bookingModes: [{ type: String, enum: ['full_day', 'day_slot', 'night_slot'], required: true }],
  notes: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RapidBooking', RapidBookingSchema);
