const mongoose = require('mongoose');
const { generateAvatarAndUpload } = require('../utils/AvatarGenerate');

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
  aadhar_number: {
    type: String,
    required:false
  },
  
  lastLogin: { type: Date, default: null },
  
  // ✅ Vendor avatar
  image_url: { type: String, default: null }  , 

  // ✅ Vendor status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: true
  },
   isBlocked: {
    type: Boolean,
    default: false
  }
  ,isHold:{
    type:Boolean,
    default:false
  }
}, { timestamps: true });

vendorSchema.pre('save', async function (next) {
  try {
    if (!this.image_url) {
      this.image_url = await generateAvatarAndUpload(this.name, 'vendor_avatars');
    }
    next();
  } catch (err) {
    console.error('🔥 Vendor avatar generation failed:', err);
    next(err);
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);
