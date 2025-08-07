const Admin = require('../models/AdminModel');
const bcrypt = require('bcryptjs');
const AdminValidation = require('../validationJoi/AdminValidation');
const Vendor = require('../models/VendorModel');
const {addFarmCategorySchema,addFacilitiesSchema}=require("../validationJoi/FarmCategoryAndFacilities")
const FarmCategory = require('../models/FarmCategory');
const Farm = require('../models/FarmModel'); // assuming Farm model file
const Facility = require('../models/FarmFacility');
const FarmBooking=require('../models/FarmBookingModel')
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Customer = require('../models/CustomerModel')
const Otp=require("../models/OtpModel")
const {messages}=require("../messageTemplates/Message");
const { sendEmail } = require('../utils/SendEmail');
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const VendorValiidation = require("../validationJoi/VendorValidation");

// Register 

exports.sendAdminOtp = async (req, res) => {
  try {
    // 🔹 Validate input
    const { error, value } = AdminValidation.sendOtpSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { email } = value;

    // 🔹 Check duplicate admin
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this email already exists.'
      });
    }

    // 🔹 Check if OTP already exists and enforce cooldown
    const existingOtp = await Otp.findOne({ email });
    if (existingOtp) {
      const timeSinceLastOtp = (Date.now() - existingOtp.updatedAt.getTime()) / 1000; // in seconds
      if (timeSinceLastOtp < 60) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(60 - timeSinceLastOtp)} seconds before requesting a new OTP.`
        });
      }
    }

    // 🔹 Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 🔹 Save or update OTP
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt },
      { upsert: true, new: true, timestamps: true }
    );

    // 🔹 Use message template
    const { subject, html } = messages.otp({ otp: otpCode });

    // 🔹 Send email (uncomment in production)
    await sendEmail(email, subject, html);

    // ✅ Success
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to the provided email.',
      data: {
        email,
        otp: otpCode,
        expiresIn: '5 minutes'
      }
    });

  } catch (err) {
    console.error('🚨 Error sending OTP:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while sending OTP.',
      error: err.message
    });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    // 🔹 Validate incoming request
    const { error, value } = AdminValidation.adminRegisterSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }
   const { email, otp, name, phone, password, isSuperAdmin, address } = value

    // 🔹 Check OTP record
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found On This Email. Please request a new OTP.'
      });
    }

    // 🔹 Check OTP correctness
    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again with the correct code.'
      });
    }

    // 🔹 Check OTP expiry
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // 🔹 OTP is valid → delete it
    await Otp.deleteOne({ email });

    // 🔹 Check if email is already registered (rare case after OTP sent)
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this email already exists.'
      });
    }

    // 🔹 Check if phone already exists
    const existingPhone = await Admin.findOne({ phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'An admin with this phone number already exists.'
      });
    }

    // 🔹 Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 Create Admin
    const admin = new Admin({
      name,
      email,
      phone,
      password: hashedPassword,
      
      address,    
      isSuperAdmin,
      createdBy: req.admin ? req.admin._id : null
    });

    await admin.save();

    // ✅ Success response
    return res.status(201).json({
      success: true,
      message: 'Admin registered successfully.',
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
          address: admin.address,
        permissions: admin.permissions,
        isSuperAdmin: admin.isSuperAdmin
      }
    });

  } catch (err) {
    console.error('🚨 Error registering admin:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during admin registration.',
      error: err.message
    });
  }
};

// Login

exports.loginAdmin = async (req, res) => {
  try {
    // 🔹 Validate request body
    const { error, value } = AdminValidation.adminLoginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { email, password } = value;

    // 🔹 Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found with this email.'
      });
    }

    // 🔹 Check if admin account is active
    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact support.'
      });
    }

    // 🔹 Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password.'
      });
    }

    // ✅ Update last login timestamp
    admin.lastLogin = new Date();
    await admin.save();

    // ✅ Generate JWT Token including lastLogin timestamp
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin.getTime() // important for token invalidation
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ✅ Send token in header for frontend convenience
    res.setHeader('Authorization', `Bearer ${token}`);

    // ✅ Success response
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: admin.permissions
      }
    });

  } catch (err) {
    console.error('🚨 Admin login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during admin login.',
      error: err.message
    });
  }
};


// Change Password  
exports.changePassword = async (req, res) => {
  try {
    // ✅ Validate request body with Joi
    const { error, value } = AdminValidation.changePasswordSchema.validate(req.body, { abortEarly: false });
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
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found.'
      });
    }

    // ✅ Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Old password is incorrect.'
      });
    }

    // ✅ Prevent reusing old password
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be the same as the old password.'
      });
    }

    // ✅ Hash and update password
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

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

// Forgot Password

exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { error, value } = AdminValidation.forgotPasswordRequestSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: error.details.map(e => e.message) });
    }

    const { email } = value;

    // ✅ Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin with this email does not exist.' });
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
    const { error, value } = AdminValidation.verifyOtpSchema.validate(req.body, { abortEarly: false });
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
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // ✅ Prevent reusing old password
    if (await bcrypt.compare(newPassword, admin.password)) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as old password.' });
    }

    // ✅ Update password
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    // ✅ Remove OTP record
    await Otp.deleteOne({ email });

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });

  } catch (err) {
    console.error('🚨 Reset Password Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
  }
};


// vendor 

exports.updateVendorStatus = async (req, res) => {
  try {
    const  vendorId  = req.body.vendor_id;

    // ✅ 1) Validate request body
    const { error, value } =AdminValidation. updateVendorStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Find vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    

    // ✅ 4) Check redundant updates
    if (typeof value.isActive === 'boolean' && vendor.isActive === value.isActive) {
      return res.status(400).json({ error: `Vendor is already ${vendor.isActive ? 'active' : 'inactive'}.` });
    }

    if (typeof value.isVerified === 'boolean' && vendor.isVerified === value.isVerified) {
      return res.status(400).json({ error: `Vendor is already ${vendor.isVerified ? 'verified' : 'unverified'}.` });
    }

    if (typeof value.isBlocked === 'boolean' && vendor.isBlocked === value.isBlocked) {
      return res.status(400).json({ error: `Vendor is already ${vendor.isBlocked ? 'blocked' : 'unblocked'}.` });
    }

    // ✅ 5) Apply only provided changes
    if (typeof value.isActive === 'boolean') vendor.isActive = value.isActive;
    if (typeof value.isVerified === 'boolean') vendor.isVerified = value.isVerified;
    if (typeof value.isBlocked === 'boolean') vendor.isBlocked = value.isBlocked;

    await vendor.save();

    return res.status(200).json({
      message: '✅ Vendor status updated successfully.',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        isActive: vendor.isActive,
        isVerified: vendor.isVerified,
        isBlocked: vendor.isBlocked
      }
    });

  } catch (err) {
    console.error('🚨 Error updating vendor status:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.getAllApprovedVendors = async (req, res) => {
  try {
    const { error, value } = AdminValidation.approvedVendorQuerySchema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const page = parseInt(value.page) || 1;
    const limit = parseInt(value.limit) || 10;

    const skip = (page - 1) * limit;

    // ✅ Use safe defaults for sort fields
    const safeSortBy = value.sortBy && value.sortBy !== '' ? value.sortBy : 'createdAt';
    const sortDir = value.sortOrder === 'asc' ? 1 : -1;
    const sort = { [safeSortBy]: sortDir };

    const vendors = await Vendor.find({
      isActive: true,
      isVerified: true,
      isBlocked: false
    })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-password -__v -createdAt -updatedAt')
      .lean();

    console.log("✅ vendor result:", vendors);

    const total = await Vendor.countDocuments({
      isActive: true,
      isVerified: true,
      isBlocked: false
    });

    return res.status(200).json({
      message: '✅ Approved vendors fetched successfully.',
      total,
      page,
      limit,
      vendors
    });

  } catch (err) {
    console.error('❌ Error fetching approved vendors:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};


exports.deleteVendorFarm = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ownerId = req.user.id;

    // ✅ 1. Validate Body
    const { error, value } = VendorValiidation.deleteVendorFarmSchema.validate(
      req.body,
      { abortEarly: false }
    );
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    const { farmId } = value;

    // ✅ 2. Check ObjectId Validity
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Invalid farmId format" });
    }

    // ✅ 3. Find Farm
    const farm = await Farm.findById(farmId).session(session);
    if (!farm) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Farm not found. Please check the farmId.",
      });
    }

    // ✅ 4. Ownership Check
    // if (farm.owner.toString() !== ownerId.toString()) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(403).json({
    //     success: false,
    //     message: "You are not authorized to delete this farm.",
    //   });
    // }

    // ✅ 5. Cancel All Related Bookings
    const cancelResult = await FarmBooking.updateMany(
      { farm: farmId, status: { $nin: ["cancelled", "complete"] } },
      { $set: { status: "cancelled" } },
      { session }
    );

    // ✅ 6. Delete Farm
  // ✅ Soft delete instead of removing
farm.isActive = false;
farm.isApproved = false;
farm.isHold = true;
farm.isDraft = true;
farm.deletedAt = new Date();

await farm.save({ session });
    await session.commitTransaction();
    session.endSession();

    // ✅ 7. Return Response
    return res.status(200).json({
      success: true,
      message: `Farm '${farm.name}' deleted successfully. ${cancelResult.modifiedCount} bookings were cancelled.`,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[DeleteVendorFarm Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
// add ,get categori and facilites  

exports.addFarmCategory = async (req, res) => {
  try {
    // ✅ Step 1: Validate input
    const { error, value } = addFarmCategorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const name = value.name.trim();

    // ✅ Step 2: Check for duplicate (case-insensitive)
    const existing = await FarmCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ message: 'Category with this name already exists' });
    }

    // ✅ Step 3: Create category
    const category = new FarmCategory({ name });
    await category.save();

    // ✅ Step 4: Optionally push to farm model's categories array (if exists)
   
    await Farm.updateMany({}, { $push: { categories: category._id } }); // optional logic

    return res.status(201).json({
      message: 'Farm category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Error adding farm category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.addFacilities = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ Step 1: Validate input
    const { error, value } = addFacilitiesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const facilitiesToAdd = value.facilities;

    // ✅ Step 2: Prepare normalized sets (only for provided class_name)
    const nameSet = new Set(facilitiesToAdd.map(f => f.name.trim().toLowerCase()));
    const classNameSet = new Set(
      facilitiesToAdd.filter(f => f.class_name).map(f => f.class_name.trim().toLowerCase())
    );

    // ✅ Step 3: Check for existing duplicates in DB
    const existingFacilities = await Facility.find({
      $or: [
        { name: { $in: Array.from(nameSet).map(n => new RegExp(`^${n}$`, 'i')) } },
        { class_name: { $in: Array.from(classNameSet).map(n => new RegExp(`^${n}$`, 'i')) } }
      ]
    });

    if (existingFacilities.length > 0) {
      const duplicates = existingFacilities.map(f => ({
        name: f.name,
        class_name: f.class_name
      }));
      return res.status(409).json({
        success: false,
        message: 'One or more facilities already exist.',
        duplicates
      });
    }

    // ✅ Step 4: Build insert payload without adding `class_name` when empty
    const newFacilities = facilitiesToAdd.map(facility => {
      const data = {
        name: facility.name.trim(),
        icon: facility.icon?.trim() || null
      };
      if (facility.class_name && facility.class_name.trim() !== '') {
        data.class_name = facility.class_name.trim();
      }
      return data;
    });

    // ✅ Step 5: Insert using transaction
    const insertedFacilities = await Facility.insertMany(newFacilities, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: `${insertedFacilities.length} facility(ies) added successfully`,
      data: insertedFacilities
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Error adding facilities:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};

exports.getAllFacilities = async (req, res) => {
  try {
    // You can add query filters later if needed
       const facilities = await Facility.find({}, '_id name').sort({ createdAt: -1 });

    if (!facilities || facilities.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No facilities found'
      });
    }

    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities
    });

  } catch (error) {
    console.error('Error fetching facilities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    // You can add query filters later if needed
       const farmCategory = await FarmCategory.find({}, '_id name').sort({ createdAt: -1 });

    if (!farmCategory || farmCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No farmCategory found'
      });
    }

    res.status(200).json({
      success: true,
      count: farmCategory.length,
      data: farmCategory
    });

  } catch (error) {
    console.error('Error fetching farmCategory:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// all bookings 

exports.getAllBookings = async (req, res) => {
  try {
    // ✅ Validate input
    const { error, value } = AdminValidation.getAllBookingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    // ✅ Normalize pagination with fallback defaults
    const page = parseInt(value.page) || 1;
    const limit = parseInt(value.limit) || 10;
    const { bookingId, date, booking_source_type } = value;

    // ✅ Build filter
    const filter = {};

    if (bookingId) {
      filter.Booking_id = bookingId;
    }

    if (date) {
      const bookingDate = new Date(date);
      const startOfDay = new Date(bookingDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(bookingDate.setHours(23, 59, 59, 999));
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (booking_source_type) {
      filter.bookingSource = booking_source_type;
    }

    // ✅ Fetch bookings with pagination
    const total = await FarmBooking.countDocuments(filter);
 const bookings = await FarmBooking.find(filter)
  .populate('farm', 'name location')
  .populate('customer', 'name phone email')
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .lean();
  const updatedBookings = bookings.map(b => {
  if (!b.farm && b.farmSnapshot) {
    b.farm = b.farmSnapshot; // fallback display
    b.farm.isDeleted = true;
  }
  return b;
});
  //  console.log("booking ddata printing",bookings)
  return res.status(200).json({
  success: true,
  message: 'Bookings retrieved successfully',
  total,
  page,
  limit,
  data: updatedBookings
});

  } catch (err) {
    console.error('[getAllBookings Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching bookings. Please try again later.'
    });
  }
};


exports.getBookingByBookingId = async (req, res) => {
  try {
    // ✅ Step 1: Validate input
    const { error, value } = AdminValidation.getBookingByIdSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { booking_id } = value;

    // ✅ Step 2: Find booking with populated farm
    const booking = await FarmBooking.findOne({ Booking_id: booking_id })
      .populate('customer')
      .populate('farm');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // ✅ Step 3: Convert to object
    const bookingObj = booking.toObject();

    // ✅ Helper to convert HH:mm → hh:mm AM/PM
    const toAmPm = (time) => {
      if (!time) return null;
      let [h, m] = time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
    };

    // ✅ Step 4: Extract checkIn/checkOut for booking date
    let checkInOut = {};
    if (bookingObj.farm?.dailyPricing && bookingObj.date) {
      const bookingDate = new Date(bookingObj.date).toISOString().split('T')[0];

      const matched = bookingObj.farm.dailyPricing.find(dp => {
        const dpDate = new Date(dp.date).toISOString().split('T')[0];
        return dpDate === bookingDate;
      });

      if (matched) {
        checkInOut = { 
          checkIn: toAmPm(matched.checkIn), 
          checkOut: toAmPm(matched.checkOut) 
        };
      }
    }

    // ✅ Step 5: Remove unwanted fields
    delete bookingObj.__v;
    delete bookingObj.createdAt;
    delete bookingObj.updatedAt;

    if (bookingObj.farm) {
      delete bookingObj.farm.__v;
      delete bookingObj.farm.createdAt;
      delete bookingObj.farm.updatedAt;
      delete bookingObj.farm.location;
      delete bookingObj.farm.defaultPricing;
      delete bookingObj.farm.farmCategory;
      delete bookingObj.farm.images;
      delete bookingObj.farm.bookingModes;
      delete bookingObj.farm.facilities;
      delete bookingObj.farm.owner;
      delete bookingObj.farm.currency;
      delete bookingObj.farm.capacity;
      delete bookingObj.farm.unavailableDates;
      delete bookingObj.farm.isActive;
      delete bookingObj.farm.isApproved;
      delete bookingObj.farm.dailyPricing;

      // ✅ Add only AM/PM formatted times
      bookingObj.farm.checkInOut = checkInOut;
    }

    // ✅ Step 6: Send clean response
    res.status(200).json({
      message: 'Booking details fetched successfully',
      data: bookingObj
    });

  } catch (err) {
    console.error('[GetBookingByBookingId Error]', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};

// all customers 

exports.getAllCustomers = async (req, res) => {
  try {
    // ✅ Validate request body
    const { error, value } = AdminValidation.customerQuerySchema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    // ✅ Destructure and safely handle defaults
    const {
      search = '',
      isBlacklisted,
      page = 1,
      limit = 10
    } = value;

    const sortField = value.sortBy && value.sortBy !== '' ? value.sortBy : 'createdAt';
    const sortDir = value.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDir };

    const skip = (page - 1) * limit;

    // 🔍 Build filter
    const filter = {};

    if (typeof isBlacklisted === 'boolean') {
      filter.isBlacklisted = isBlacklisted;
    }

    if (search && search.trim() !== '') {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // 🧠 Fetch data
    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter)
    ]);

    // ✅ Send response
    return res.status(200).json({
      message: '✅ Customers fetched successfully.',
      total,
      page,
      limit,
      customers
    });
  } catch (err) {
    console.error('❌ Error fetching customers:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// all vendors 

exports.getAllVendors = async (req, res) => {
  try {
    const { error, value } = AdminValidation.vendorQuerySchema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const {
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = value;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // 🔍 Filter vendors by email/phone/name
    const vendorFilter = {};
    let vendorIdsFromFarms = [];

    if (search && search.trim()) {
      const query = search.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
      const isPhone = /^[0-9]{10}$/.test(query);
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(query);

      const $or = [];

      if (isEmail) {
        $or.push({ email: { $regex: query, $options: 'i' } });
      } else if (isPhone) {
        $or.push({ phone: { $regex: query } });
      } else {
        $or.push({ name: { $regex: query, $options: 'i' } });
      }

      vendorFilter.$or = $or;

      // 🔁 Also search in farms
      const farmSearchFilter = {};
      if (!isEmail && !isPhone) {
        if (isMongoId) {
          farmSearchFilter._id = query;
        } else {
          farmSearchFilter.name = { $regex: query, $options: 'i' };
        }

        const farms = await Farm.find(farmSearchFilter).select('owner').lean();
        vendorIdsFromFarms = farms.map(f => f.owner.toString());
      }
    }

    // 🧠 Get vendors
    let matchedVendors = await Vendor.find(vendorFilter).lean();

    if (vendorIdsFromFarms.length) {
      const uniqueSet = new Set([
        ...matchedVendors.map(v => v._id.toString()),
        ...vendorIdsFromFarms
      ]);
      matchedVendors = await Vendor.find({ _id: { $in: Array.from(uniqueSet) } }).lean();
    }

    // ✨ Clean + Attach Farms
    const cleanVendors = await Promise.all(
  matchedVendors.map(async (vendor) => {
    const farms = await Farm.find({ owner: vendor._id })
      .select('name description location capacity farmCategory isActive isApproved')
      .populate('farmCategory', 'name') // Optional: populate category names if needed
      .lean();

    return {
      id: vendor._id,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      businessName: vendor.businessName,
      isActive: vendor.isActive,
      isVerified: vendor.isVerified,
      isBlocked: vendor.isBlocked,
      farms
    };
  })
);

    // 📊 Sort + Paginate
    const sorted = cleanVendors.sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    const paginated = sorted.slice(skip, skip + limit);

    return res.status(200).json({
      message: '✅ Vendors fetched successfully.',
      total: sorted.length,
      page,
      limit,
      vendors: paginated
    });
  } catch (err) {
    console.error('❌ Error fetching vendors:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.getVendorFarmById = async (req, res) => {
  try {
    // const ownerId = req.user.id;

    // ✅ 1. Validate Request Body
    const { error, value } = AdminValidation.getFarmByVendorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map(e => e.message)
      });
    }

    const { farmId } = value;

    // ✅ 2. Check if farmId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(farmId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid farmId format"
      });
    }

    // ✅ 3. Check if farm exists (without owner check first)
    const farmExists = await Farm.findById(farmId)
      .populate("farmCategory", "_id name")
      .populate("facilities", "_id name icon");

    if (!farmExists) {
      return res.status(404).json({
        success: false,
        message: "Farm not found. Please check the farmId and try again."
      });
    }

    // ✅ 4. Check if the farm belongs to the vendor
    // if (farmExists.owner.toString() !== ownerId.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "You are not authorized to access this farm."
    //   });
    // }

    // ✅ 5. Send Success Response
    return res.status(200).json({
      success: true,
      message: "Farm details fetched successfully",
      data: farmExists
    });

  } catch (err) {
    console.error("[GetVendorFarmById Error]", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    });
  }
};

exports.getVendorWithFarms = async (req, res) => {
  try {
    // ✅ Step 1: Validate input (vendor_id in body)
    const { error, value } =AdminValidation.getVendorByIdSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const vendorId = value.vendor_id;

    // ✅ Step 2: Fetch Vendor (excluding password)
    const vendor = await Vendor.findById(vendorId).select('-password');
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
   // ✅ Step 3: Fetch only active, non-deleted farms
    let farms = await Farm.find({
        owner: vendorId,
        deletedAt: null,       // 👈 Exclude soft-deleted farms
        isActive: true         // 👈 Optional: only return active farms
      })
      .populate('farmCategory', '_id name')
      .populate('facilities', '_id name icon')
      .lean();

    // ✅ Step 4: Remove unwanted fields from farms
    farms = farms.map(farm => {
      delete farm.defaultPricing;
      delete farm.bookingModes;
      // delete farm.dailyPricing;
      

      // ✅ Clean dailyPricing: remove "slots" but keep checkIn/checkOut
      if (farm.dailyPricing && Array.isArray(farm.dailyPricing)) {
        farm.dailyPricing = farm.dailyPricing.map(dp => ({
          date: dp.date,
          checkIn: dp.checkIn,
          checkOut: dp.checkOut
        }));
      }

      return farm;
    });

    // ✅ Step 5: Send response
    return res.status(200).json({
      message: 'Vendor details fetched successfullyyyy',
      vendor,
      farms
    });

  } catch (err) {
    console.error('[getVendorWithFarms Error]', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};





exports.getAdminProfile = async (req, res) => {
  try {
    // ✅ Step 1: Validate user ID from auth
    const { error, value } =AdminValidation. getProfileSchema.validate({ id: req.user?.id });
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    // ✅ Step 2: Find admin by ID
    const admin = await Admin.findById(value.id).lean();
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found.' });
    }

    // ✅ Step 3: Return clean profile (no password or sensitive fields)
    return res.status(200).json({
      message: '✅ Admin profile fetched successfully.',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        permissions: admin.permissions,
        isSuperAdmin: admin.isSuperAdmin,
        isActive: admin.isActive,
        address: admin.address,
        image_url:admin.image_url
      }
    });

  } catch (err) {
    console.error('🚨 Error fetching admin profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};




exports.getAllActiveFarms = async (req, res) => {
  try {
    // ✅ Step 1: Validate body for pagination only
    const { error, value } = AdminValidation.getAllFarmsSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { page, limit } = value;

    // ✅ Step 2: Pagination calculation
    const skip = (page - 1) * limit;

    // ✅ Step 3: Fetch all farms (excluding soft-deleted ones)
    let farms = await Farm.find({ deletedAt: null ,isActive: true  })  // ⛔ Exclude soft-deleted farms
      .populate('farmCategory', '_id name')           // Limit fields if needed
      .populate('facilities', '_id name icon')
      .skip(skip)
      .limit(limit)
      .lean();

    // ✅ Step 4: Clean unwanted fields
    farms = farms.map(farm => {
      delete farm.defaultPricing;
      delete farm.bookingModes;

      if (farm.dailyPricing && Array.isArray(farm.dailyPricing)) {
        farm.dailyPricing = farm.dailyPricing.map(dp => ({
          date: dp.date,
          checkIn: dp?.timings?.full_day?.checkIn,
          checkOut: dp?.timings?.full_day?.checkOut
        }));
      }
      return farm;
    });

    // ✅ Step 5: Count total non-deleted farms
    const totalFarms = await Farm.countDocuments({ deletedAt: null });

    // ✅ Step 6: Return response
    return res.status(200).json({
      message: 'All farms fetched successfully',
      pagination: {
        total: totalFarms,
        page,
        limit,
        totalPages: Math.ceil(totalFarms / limit)
      },
      data: farms
    });

  } catch (err) {
    console.error('[getAllFarms Error]', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};


exports.updateFarmStatus = async (req, res) => {
  try {
    // ✅ Step 1: Validate request body
    const { error, value } =AdminValidation. updateFarmStatusSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const { farm_id, isActive, isApproved, isHold } = value;

    // ✅ Step 2: Find farm
    const farm = await Farm.findById(farm_id);
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // ✅ Step 3: Prepare potential new status (use existing if not provided)
    const newStatus = {
      isActive: typeof isActive !== 'undefined' ? isActive : farm.isActive,
      isApproved: typeof isApproved !== 'undefined' ? isApproved : farm.isApproved,
      isHold: typeof isHold !== 'undefined' ? isHold : farm.isHold
    };

    // ✅ Step 4: Business Rules Enforcement
    if (newStatus.isActive === true && newStatus.isApproved === false) {
      return res.status(400).json({
        error: 'Cannot set isActive=true when isApproved=false.'
      });
    }

    if (newStatus.isHold === true && newStatus.isActive === false) {
      return res.status(400).json({
        error: 'Cannot set isHold=true while isActive=false.'
      });
    }

    // ✅ Step 5: Track changes
    let changes = [];

    if (typeof isActive !== 'undefined') {
      if (farm.isActive === isActive) {
        changes.push('isActive (no change)');
      } else {
        farm.isActive = isActive;
        changes.push(`isActive → ${isActive}`);
      }
    }

    if (typeof isApproved !== 'undefined') {
      if (farm.isApproved === isApproved) {
        changes.push('isApproved (no change)');
      } else {
        farm.isApproved = isApproved;
        changes.push(`isApproved → ${isApproved}`);
      }
    }

    if (typeof isHold !== 'undefined') {
      if (farm.isHold === isHold) {
        changes.push('isHold (no change)');
      } else {
        farm.isHold = isHold;
        changes.push(`isHold → ${isHold}`);
      }
    }

    // ✅ Step 6: Check if any real change happened
    const hasRealChange = changes.some(c => !c.includes('(no change)'));
    if (!hasRealChange) {
      return res.status(200).json({
        message: 'No status update required. Farm already has the provided statuses.',
        currentStatus: {
          isActive: farm.isActive,
          isApproved: farm.isApproved,
          isHold: farm.isHold
        }
      });
    }

    // ✅ Step 7: Save changes
    await farm.save();

    // ✅ Step 8: Send response
    return res.status(200).json({
      message: 'Farm status updated successfully',
      updatedFields: changes,
      data: {
        farm_id: farm._id,
        isActive: farm.isActive,
        isApproved: farm.isApproved,
        isHold: farm.isHold
      }
    });

  } catch (err) {
    console.error('[updateFarmStatus Error]', err);
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
};



exports.updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;

    const { error, value = {} } =AdminValidation. adminUpdateSchema.validate(req.body || {}, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(e => e.message)
      });
    }

    const email = value.email;
    const phone = value.phone;

    // ✅ Duplicate checks
    if (email) {
      const existing = await Admin.findOne({ email, _id: { $ne: adminId } });
      if (existing) return res.status(409).json({ success: false, message: 'Email already in use by another admin.' });
    }
    if (phone) {
      const existingPhone = await Admin.findOne({ phone, _id: { $ne: adminId } });
      if (existingPhone) return res.status(409).json({ success: false, message: 'Phone number already in use by another admin.' });
    }

    // ✅ Handle image upload
    if (req.files && req.files.image) {
      try {
        const uploadedUrls = await uploadFilesToCloudinary([req.files.image], 'admin_profiles');
        value.image_url = uploadedUrls[0];
      } catch (uploadErr) {
        return res.status(400).json({
          success: false,
          message: 'Image upload failed',
          error: uploadErr.message
        });
      }
    }

    if (Object.keys(value).length === 0) {
      return res.status(400).json({ success: false, message: 'No data provided for update.' });
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { $set: value },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedAdmin) return res.status(404).json({ success: false, message: 'Admin not found.' });

    // ✅ Map technical fields → user-friendly names
    const fieldNames = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone Number',
      address: 'Address',
      image_url: 'Profile Image'
    };

    // ✅ Convert keys into readable list
    const updatedKeys = Object.keys(value).map(k => fieldNames[k] || k);
    const readableFields =
      updatedKeys.length > 1
        ? `${updatedKeys.slice(0, -1).join(', ')} and ${updatedKeys.slice(-1)}`
        : updatedKeys[0];

    return res.status(200).json({
      success: true,
      message: `${readableFields} ${updatedKeys.length > 1 ? 'were' : 'was'} updated successfully.`,
      data: updatedAdmin
    });

  } catch (err) {
    console.error('🚨 Error updating profile:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during profile update.',
      error: err.message
    });
  }
};

