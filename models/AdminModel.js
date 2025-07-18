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
phone: {
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
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
