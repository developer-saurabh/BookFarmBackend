const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  // 🔑 Basic details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },

  // 🏷️ Overall type (fixed: venue)
  type: {
    type: String,
    enum: ['venue'],
    default: 'venue'
  },
capacity: {
  type: Number,
  required: true // Makes sense to always know how many people it fits
},
  // 🏛️ Specific category (Wedding Hall, Banquet, etc.)
  category: {
    type: String,
    enum: [
      'Wedding Hall',
      'Banquet',
      'Party Lawn',
      'Conference Hall',
      'Meeting Room',
      'Exhibition Hall',
      'Auditorium',
      'Other'
    ],
    required: true
  },

  // 📍 Location details (NO geo/map)
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pinCode: {
      type: String
    }
  },
  bookingModes: {
    type: [String],
    enum: ['full_day', 'day_slot', 'night_slot'],
    default: ['full_day']
  },
  // 💰 Pricing
  pricing: {
    fullDay: { type: Number },
    daySlot: { type: Number },
    nightSlot: { type: Number }
  },
currency: { type: String, default: 'INR' },
  // 📸 Media
  images: [{
    type: String,
    default:null
  }],

  // 📅 Availability
  availableDates: [{
    type: Date
  }],

  // ✅ Amenities (stage, AC, parking, decor, etc.)
  amenities: [{
    type: String
  }],

  // 📌 Vendor owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },

  // 📊 Status & admin controls
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

module.exports = mongoose.model('Venue', venueSchema);
