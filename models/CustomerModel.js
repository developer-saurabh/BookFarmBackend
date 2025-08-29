const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  email: {
    type: String,
    required: false,
    unique: true
  },
  isBlacklisted: { type: Boolean, default: false },


}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
