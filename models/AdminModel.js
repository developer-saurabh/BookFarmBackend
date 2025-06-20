const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
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
  password: {
    type: String,
    required: true
  },

  // ✅ Permissions — for role-based access control (RBAC)
  permissions: [{
    type: String
    // Example: 'VIEW_ALL_BOOKINGS', 'MANAGE_VENDORS', 'APPROVE_VENUES'
  }],

  // ✅ Admin status
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
