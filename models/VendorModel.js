const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  // ✅ Auth details
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },

  // ✅ Business details
  businessName: {
    type: String
  },

  // ✅ Vendor status
  isActive: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
   isBlocked: {
    type: Boolean,
    default: false
  }
  
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);
