const mongoose = require('mongoose');

const propertyDetailSchema = new mongoose.Schema({
  bhkField: { 
    type: String, 
    required: true, 
    trim: true 
  }, // e.g., "2 BHK", "3 BHK Villa"

  squareFt: { 
    type: Number, 
    required: true 
  }, // e.g., 2500 (sq.ft)

  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('PropertyDetail', propertyDetailSchema);
