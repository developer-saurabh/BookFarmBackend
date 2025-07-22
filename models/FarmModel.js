const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  // 🔑 Basic details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },

  // 🔁 Changed from enum to ref
  farmCategory:[{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmCategory',
    required: true
  }],


  // 📍 Location details (basic, no geo)
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
    },
    mapLink: {
      type: String, // optional, if you share map URLs manually
      default:null
    }
  },
  bookingModes: {
    type: [String],
    enum: ['full_day', 'day_slot', 'night_slot'],
    default: ['full_day']
  },
  // 💰 Pricing
dailyPricing: [{
  date: {
    type: Date,
    required: true
  },
  slots: {
    full_day: { type: Number, default: 0 },
    day_slot: { type: Number, default: 0 },
    night_slot: { type: Number, default: 0 }
  }
}],
defaultPricing: {
  full_day: { type: Number },
  day_slot: { type: Number },
  night_slot: { type: Number }
},
  currency: {
    type: String,
    default: 'INR'
  },

  // 📸 Media
  images: [{
    type: String
  }],



  // ✅ Amenities
    facilities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm_Facility'
  }],
  capacity: {
    type: Number,
    required: true // Makes sense to always know how many people it fits
  },
  // 📌 Vendor owner
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },

 unavailableDates: {
  type: [Date],
  default: [],
  required: false
},

  // 📊 Status & admin controls
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: true
  },

}, { timestamps: true });

module.exports = mongoose.model('Farm', farmSchema);
