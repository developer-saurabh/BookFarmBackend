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
 type: {
  type: String,
  enum: ['Organic Farm', 'Event Farm', 'Resort Farm', 'Other']
},


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
      type: String // optional, if you share map URLs manually
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
  currency: {
    type: String,
    default: 'INR'
  },

  // 📸 Media
  images: [{
    type: String
  }],



  // ✅ Amenities
  amenities: [{
    type: String
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
