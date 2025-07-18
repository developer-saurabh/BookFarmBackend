const mongoose = require('mongoose');

const helpDeskInquirySchema = new mongoose.Schema({
 
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: false
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open'
  }
}, { timestamps: true });

module.exports = mongoose.model('HelpDeskInquiry', helpDeskInquirySchema);
