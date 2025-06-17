const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['Venue', 'Farm'], required: true },
  item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'type' },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' },
});

module.exports = mongoose.model('Booking', bookingSchema);
