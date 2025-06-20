const mongoose = require('mongoose');

const venueBookingSchema = new mongoose.Schema({
  // Customer info
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  // Link to Venue
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: true
  },
  category: {
    type: String,
    enum: [
      'Wedding Hall',
      'Banquet',
      'Party Lawn',
      'Conference Hall',
      'Meeting Room',
      'Exhibition Hall',
      'Auditorium',
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

module.exports = mongoose.model('VenueBooking', venueBookingSchema);
