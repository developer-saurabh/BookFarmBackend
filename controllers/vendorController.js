const Vendor = require('../models/VendorModel');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const FarmCategory=require("../models/FarmCategory")
const Facility=require("../models/FarmFacility")
const VendorValiidation= require('../validationJoi/VendorValidation');
// const sendAdminEmail = require('../utils/sendAdminEmail');
const Farm = require('../models/FarmModel');
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const Otp=require("../models/OtpModel")
const { sendEmail } = require('../utils/SendEmail');
const {messages}=require("../messageTemplates/Message");


// Auth Apis

exports.registerVendor = async (req, res) => {
  try {
    // ✅ 1) Validate input with Joi
    const { error, value } = VendorValiidation.vendorRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Extra Safety Check: Password & Confirm Password Match
    if (value.password !== value.confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    }

    // ✅ 3) Check for duplicate email
    const existingEmail = await Vendor.findOne({ email: value.email });
    if (existingEmail) {
      return res.status(409).json({ error: 'A vendor with this email already exists.' });
    }

    // ✅ 4) Check for duplicate phone
    const existingPhone = await Vendor.findOne({ phone: value.phone });
    if (existingPhone) {
      return res.status(409).json({ error: 'A vendor with this phone number already exists.' });
    }

    // ✅ 5) Hash password securely
    const hashedPassword = await bcrypt.hash(value.password, 10);

    // ✅ 6) Save vendor
    const vendor = new Vendor({
      name: value.name,
      email: value.email,
      phone: value.phone,
      password: hashedPassword,
      aadhar_number: value.aadhar_number
    });

    await vendor.save();

    // ✅ 6) Notify admin
    // await sendAdminEmail({
    //   subject: '🆕 New Vendor Registration',
    //   text: `A new vendor has registered: ${vendor.name} (${vendor.email}). Please review and verify.`
    // });
    return res.status(201).json({
      message: '✅ Vendor registered successfully. Awaiting admin approval.'
    });

  } catch (err) {
    console.error('🚨 Error registering vendor:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
exports.loginVendor = async (req, res) => {
  try {
    // ✅ 1) Validate input
    const { error, value } = VendorValiidation.vendorLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Find vendor by email
    const vendor = await Vendor.findOne({ email: value.email });
    if (!vendor) {
      return res.status(404).json({ error: 'Email not found. Please register first or check your email address.' });
    }

    // ✅ 3) Check vendor status BEFORE comparing password
    if (!vendor.isVerified) {
      return res.status(403).json({ error: 'Vendor is not verified. Please contact admin.' });
    }
    if (!vendor.isActive) {
      return res.status(403).json({ error: 'Vendor account is inactive. Please contact admin.' });
    }
    if (vendor.isBlocked) {
      return res.status(403).json({ error: 'Vendor account is blocked. Access denied.' });
    }

    // ✅ 4) Compare password
    const isMatch = await bcrypt.compare(value.password, vendor.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // ✅ 5) Update last login
    vendor.lastLogin = new Date(); 
    await vendor.save();

    // ✅ 6) Generate JWT with lastLogin
    const token = jwt.sign(
      {
        id: vendor._id,
        email: vendor.email,
        role: 'vendor',
        lastLogin: vendor.lastLogin.getTime()
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ✅ 7) Send token in header
    res.setHeader('Authorization', `Bearer ${token}`);

    // ✅ 8) Response
    return res.status(200).json({
      message: '✅ Login successful.',
      token,
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone
      }
    });

  } catch (err) {
    console.error('🚨 Error logging in vendor:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// Forgot Password

exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { error, value } = VendorValiidation.forgotPasswordRequestSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(e => e.message) });
    }

    const { email } = value;

    // ✅ Check if admin exists
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor with this email does not exist.' });
    }

    // ✅ Check OTP cooldown (1 minute)
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      const secondsSinceLastOtp = (Date.now() - existingOtp.updatedAt.getTime()) / 1000;
      if (secondsSinceLastOtp < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(60 - secondsSinceLastOtp)} seconds before requesting another OTP.`
        });
      }
    }

    // ✅ Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // ✅ Save/Update OTP with `isVerified=false`
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt, isVerified: false },
      { upsert: true, new: true, timestamps: true }
    );

    // ✅ Send email
    const { subject, html } = messages.forgotPasswordOtp({ otp: otpCode });
    await sendEmail(email, subject, html);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully.',
      data: { email, expiresIn: '2 minutes',otp:otpCode }
    });

  } catch (err) {
    console.error('🚨 Forgot Password Send OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while sending OTP.', error: err.message });
  }
};
exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { error, value } = VendorValiidation.verifyOtpSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(e => e.message) });
    }

    const { email, otp } = value;
    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'No OTP found With This Email . Please request a new one.' });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    // ✅ Mark OTP as verified
    otpRecord.isVerified = true;
    await otpRecord.save();

     // ✅ Generate temporary reset token
  const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '10m' });

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully. Use this token to reset your password.',
    resetToken
  });
  } catch (err) {
    console.error('🚨 Verify OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while verifying OTP.', error: err.message });
  }
};
exports.forgotPasswordReset = async (req, res) => {
  try {
    // ✅ Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ success: false, message: 'Reset token is missing in Authorization header.' });
    }

    const resetToken = authHeader.split(' ')[1];

    // ✅ Verify token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const email = decoded.email;
    const { newPassword, confirmPassword } = req.body;

    // ✅ Check passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Confirm password does not match new password.' });
    }

    // ✅ Find admin
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor account not found.' });
    }

    // ✅ Prevent reusing old password
    if (await bcrypt.compare(newPassword, vendor.password)) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as old password.' });
    }

    // ✅ Update password
    vendor.password = await bcrypt.hash(newPassword, 10);
    await vendor.save();

    // ✅ Remove OTP record
    await Otp.deleteOne({ email });

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });

  } catch (err) {
    console.error('🚨 Reset Password Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
  }
};

// change Passwrd

exports.changePassword = async (req, res) => {
  try {
    // ✅ Validate request body with Joi
    const { error, value } = VendorValiidation.changePasswordSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { oldPassword, newPassword, confirmPassword } = value;

    // ✅ Extra check (controller-level) for confirmPassword
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Confirm password does not match the new password.'
      });
    }

    // ✅ Find admin from token (ensure auth middleware sets req.admin)
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'vendor account not found.'
      });
    }

    // ✅ Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, vendor.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect.'
      });
    }

    // ✅ Prevent reusing old password
    const isSamePassword = await bcrypt.compare(newPassword, vendor.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as the old password.'
      });
    }

    // ✅ Hash and update password
    vendor.password = await bcrypt.hash(newPassword, 10);
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (err) {
    console.error('🚨 Change password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while changing password.',
      error: err.message
    });
  }
};


exports.addFarm = async (req, res) => {
  try {
    const { error, value } = VendorValiidation.farmAddValidationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(err => err.message)
      });
    }

    const ownerId = req.user.id;
    value.owner = ownerId;

    // ✅ Verify vendor
    const vendor = await Vendor.findById(ownerId);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' });
    if (!vendor.isVerified || !vendor.isActive || vendor.isBlocked) {
      return res.status(403).json({ error: 'Vendor is not eligible to add farms.' });
    }

    // 🔍 Check for duplicate farm name for this vendor
    const existingFarm = await Farm.findOne({ name: value.name, owner: ownerId });
    if (existingFarm) {
      return res.status(409).json({ error: 'A farm with this name already exists.' });
    }

    // ✅ Validate farmCategory (now supports array)
    if (Array.isArray(value.farmCategory)) {
      for (const catId of value.farmCategory) {
        const validCat = await FarmCategory.findById(catId);
        if (!validCat) return res.status(400).json({ error: 'Invalid farm category selected.' });
      }
    } else {
      const validCat = await FarmCategory.findById(value.farmCategory);
      if (!validCat) return res.status(400).json({ error: 'Invalid farm category selected.' });
    }

    // ✅ Validate facilities
    if (value.facilities && Array.isArray(value.facilities) && value.facilities.length > 0) {
      const validFacilities = await Facility.find({ _id: { $in: value.facilities } });
      if (validFacilities.length !== value.facilities.length) {
        return res.status(400).json({ error: 'One or more selected facilities are invalid.' });
      }
    }

    // 📸 Handle images
    const uploaded = req.files?.images || req.files?.image;
    if (!uploaded) {
      return res.status(400).json({ error: 'At least one image must be uploaded.' });
    }

    const imagesArray = Array.isArray(uploaded) ? uploaded : [uploaded];
    const cloudUrls = await uploadFilesToCloudinary(imagesArray, 'farms');
    value.images = cloudUrls;

    // ✅ Time conversion helpers
    const to24Hour = (time) => {
      if (!time) return null;
      const [raw, modifier] = time.trim().split(/\s+/);
      let [h, m] = raw.split(":").map(Number);
      if (modifier?.toUpperCase() === "PM" && h !== 12) h += 12;
      if (modifier?.toUpperCase() === "AM" && h === 12) h = 0;
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    };

    const toAmPm = (time) => {
      if (!time) return null;
      let [h, m] = time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
    };

    // 🔁 Validate dailyPricing: check duplicates + checkIn/Out AM-PM format
    if (value.dailyPricing && Array.isArray(value.dailyPricing)) {
      const seenDates = new Set();
      const timeRegex = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;

      for (const entry of value.dailyPricing) {
        const isoDate = new Date(entry.date).toISOString().slice(0, 10);

        if (seenDates.has(isoDate)) {
          return res.status(400).json({ error: `Duplicate pricing found for date: ${isoDate}` });
        }
        seenDates.add(isoDate);

        // ✅ Validate time format (AM/PM)
        entry.checkIn = entry.checkIn || "10:00 AM";
        entry.checkOut = entry.checkOut || "06:00 PM";

        if (!timeRegex.test(entry.checkIn) || !timeRegex.test(entry.checkOut)) {
          return res.status(400).json({ error: `Invalid time format for date ${isoDate}. Use hh:mm AM/PM format.` });
        }

        // ✅ Convert to 24-hour before saving
        const checkIn24 = to24Hour(entry.checkIn);
        const checkOut24 = to24Hour(entry.checkOut);

        // ✅ Ensure checkIn < checkOut
        const [inH, inM] = checkIn24.split(":").map(Number);
        const [outH, outM] = checkOut24.split(":").map(Number);
        const checkInMinutes = inH * 60 + inM;
        const checkOutMinutes = outH * 60 + outM;

        if (checkInMinutes >= checkOutMinutes) {
          return res.status(400).json({ error: `For date ${isoDate}, checkIn must be earlier than checkOut.` });
        }

        entry.checkIn = checkIn24;  // store in 24-hour
        entry.checkOut = checkOut24;
      }
    }

    // ✅ Save Farm
    const newFarm = await new Farm(value).save();

    // 🧠 Populate references
    let populatedFarm = await Farm.findById(newFarm._id)
      .populate('farmCategory')
      .populate('facilities')
      .lean();

    // ✅ Convert times back to AM/PM for response
    if (populatedFarm.dailyPricing) {
      populatedFarm.dailyPricing.forEach(dp => {
        dp.checkIn = toAmPm(dp.checkIn);
        dp.checkOut = toAmPm(dp.checkOut);
      });
    }

    return res.status(201).json({
      message: 'Farm added successfully',
      data: populatedFarm
    });

  } catch (err) {
    console.error('[AddFarm Error]', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};





exports.updateFarmImages = async (req, res) => {
  try {
    // ✅ Step 1: Validate body
    const { error, value } = VendorValiidation.updateFarmImagesSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { farm_id } = value;

    // ✅ Step 2: Check if farm exists
    const farm = await Farm.findById(farm_id);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // ✅ Step 3: Check if files are uploaded
    const uploadedFiles = req.files?.images || req.files?.image;
    if (!uploadedFiles) {
      return res.status(400).json({ error: 'No images uploaded.' });
    }

    // ✅ Step 4: Normalize files array
    const filesArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

    // ✅ Step 5: Upload new images to Cloudinary
    const newImageUrls = await uploadFilesToCloudinary(filesArray, 'farms');

    // ✅ Step 6: Replace old images with new images
    farm.images = newImageUrls;

    // ✅ Step 7: Save updated farm
    await farm.save();

    // ✅ Step 8: Response
    return res.status(200).json({
      message: 'Farm images replaced successfully',
      newImages: newImageUrls
    });

  } catch (err) {
    console.error('[updateFarmImages Error]', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};