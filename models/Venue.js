const mongoose = require('mongoose');
const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // e.g., Wedding Hall, Banquet, etc.
  location: String,
  capacity: Number,
  images: [String],  // Array of image URLs
  availableDates: [Date],
});
module.exports = mongoose.model('Venue', venueSchema);
