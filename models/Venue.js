const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  capacity: Number,
  images: [String],  // URLs
  availableDates: [Date],
});

module.exports = mongoose.model('Venue', venueSchema);
