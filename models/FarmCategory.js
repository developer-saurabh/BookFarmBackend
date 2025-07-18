// models/FarmCategory.js
const mongoose = require('mongoose');

const farmCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('FarmCategory', farmCategorySchema);
