const mongoose = require('mongoose');

const farmBookingSchema = new mongoose.Schema({
  // Customer contact info (NO login)
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },
  type: {
    type: String,
    enum: [
      'Organic Farm',
      'Event Farm',
      'Resort Farm',
      'Private Farmhouse',
      'Other'
    ],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: String,

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },

 
}, { timestamps: true });

module.exports = mongoose.model('FarmBooking', farmBookingSchema);
