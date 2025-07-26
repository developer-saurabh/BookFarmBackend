const mongoose = require('mongoose');
const Farm = require('./FarmModel'); // make sure this path is correct


const farmBookingSchema = new mongoose.Schema({
  // 👤 Customer Info
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },
  Booking_id:{
    type:Number,
    default:null
  },

  // 🌾 Farm Reference
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },




  // 📅 Booking Details
  date: { type: Date, required: true },


  // 📦 Booking Mode
  bookingModes: {
    type: [String],
    enum: ['full_day', 'day_slot', 'night_slot'],
    default: ['full_day']
  },

  // 🔄 Status Tracking
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'complete'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  totalPrice: { type: Number, required: true },
priceBreakdown: {
  type: Map,
  of: Number,
  default: {}
},
bookingSource: {
  type: String,
  enum: ['website', 'whatsapp'],
  default: 'website'
},
Guest_Count:{
  type:Number
},
Group_Category:{
  type:String
}
}, { timestamps: true });





module.exports = mongoose.model('FarmBooking', farmBookingSchema);
