const mongoose = require('mongoose');

const { generateAvatarAndUpload } = require('../utils/AvatarGenerate');


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
   address: { type: String, required: true, trim: true },

  // ✅ Admin status
  isSuperAdmin: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image_url:{
    type:String,
    default:null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  lastLogin: { type: Date, default: null }

}, { timestamps: true });



adminSchema.pre('save', async function (next) {
  try {
    if (!this.image_url) {
      this.image_url = await generateAvatarAndUpload(this.name, 'admin_avatars');
    }
    next();
  } catch (err) {
    console.error('🔥 Admin avatar generation failed:', err);
    next(err);
  }
});

module.exports = mongoose.model('Admin', adminSchema);
