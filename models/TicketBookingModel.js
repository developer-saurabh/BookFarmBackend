const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'bookingModel'
  },
  bookingModel: {
    type: String,
    enum: ['VenueBooking', 'FarmBooking'],
    required: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  type: {
    type: String,
    enum: ['venue', 'farm'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
