const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  profilePic: { type: String }, // optional, if you fetch via WhatsApp API
  currentState: {
    type: String,
      enum: [
      'new',
      'greeted',
      'awaiting_option',
      'choosing_venue_type',
      'booking_venue',
      'booking_venue_date',
      'choosing_farm_type',
      'booking_farm',
      'booking_farm_date',
      'checking_availability',
      'cancelling',
      'done'
    ],
    default: 'new'
  },
metaData: {
  type: mongoose.Schema.Types.Mixed,
  default: {},
},

  lastInteraction: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
