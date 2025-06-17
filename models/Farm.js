const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  size: String,
  images: [String],
  availableDates: [Date],
});

module.exports = mongoose.model('Farm', farmSchema);
