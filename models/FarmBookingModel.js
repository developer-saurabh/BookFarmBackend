const mongoose = require('mongoose');
const Farm = require('./FarmModel'); // make sure this path is correct

const farmBookingSchema = new mongoose.Schema({
  // 👤 Customer Info
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },

  // 🌾 Farm Reference
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },

  // 🧠 Auto-populated from Farm at save-time
  farmType: {
    type: String,
     enum: [
  "Organic Farm",
  "Event Farm",
  "Resort Farm",
  "Private Farmhouse",
  "Dairy Farm",
  "Goat Farm",
  "Poultry Farm",
  "Hydroponic Farm",
  "Agri-Tourism Farm",
  "Luxury Farmstay",
  "Adventure Farm",
  "Eco Farm",
  "Community Farm",
  "Educational Farm",
  "Film Shooting Farm",
  "other"
]
  },

  // 📅 Booking Details
  date: { type: Date, required: true },


  // 📦 Booking Mode
  bookingModes: {
    type: [String],
    enum: ['full_day', 'day_slot', 'night_slot'],
    default: ['full_day']
  },

  // 🔄 Status Tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'complete'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  totalPrice: { type: Number, required: true },
priceBreakdown: {
  type: Map,
  of: Number,
  default: {}
}


}, { timestamps: true });

// farmBookingSchema.index({ farm: 1, date: 1, timeSlot: 1 }, { unique: true });




module.exports = mongoose.model('FarmBooking', farmBookingSchema);
