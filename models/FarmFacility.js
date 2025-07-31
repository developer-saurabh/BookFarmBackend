const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  class_name: {
    type: String,
    required: false,
    trim: true,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// ✅ Create a unique index on class_name but ignore null/missing
facilitySchema.index(
  { class_name: 1 },
  { unique: true, partialFilterExpression: { class_name: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model('Farm_Facility', facilitySchema);
