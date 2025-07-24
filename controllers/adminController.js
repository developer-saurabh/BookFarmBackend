const Admin = require('../models/AdminModel');
const bcrypt = require('bcryptjs');
const {adminRegisterSchema} = require('../validationJoi/AdminValidation');
const Vendor = require('../models/VendorModel');
const {updateVendorStatusSchema} = require('../validationJoi/AdminValidation');
const {addFarmCategorySchema,addFacilitiesSchema}=require("../validationJoi/FarmCategoryAndFacilities")
const FarmCategory = require('../models/FarmCategory');
const Farm = require('../models/FarmModel'); // assuming Farm model file
const Facility = require('../models/FarmFacility');
const mongoose = require('mongoose');


exports.registerAdmin = async (req, res) => {
  try {
    // ✅ Validate input
    const { error, value } = adminRegisterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ Check if email exists
    const existingEmail = await Admin.findOne({ email: value.email });
    if (existingEmail) {
      return res.status(409).json({ error: 'An admin with this email already exists.' });
    }

    // ✅ Check if phone exists
    const existingPhone = await Admin.findOne({ phone: value.phone });
    if (existingPhone) {
      return res.status(409).json({ error: 'An admin with this phone number already exists.' });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(value.password, 10);

    // ✅ Create new Admin
    const admin = new Admin({
      name: value.name,
      email: value.email,
      phone: value.phone,
      password: hashedPassword,
      permissions: value.permissions,
      isSuperAdmin: value.isSuperAdmin,
      isActive: true,
      createdBy: req.admin ? req.admin._id : null // Optional audit trail
    });

    await admin.save();

    return res.status(201).json({
      message: '✅ Admin registered successfully.',
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        permissions: admin.permissions,
        isSuperAdmin: admin.isSuperAdmin,
        isActive: admin.isActive
      }
    });

  } catch (err) {
    console.error('🚨 Error registering admin:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};  

exports.updateVendorStatus = async (req, res) => {
  try {
    const  vendorId  = req.params.id;

    // ✅ 1) Validate request body
    const { error, value } = updateVendorStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Find vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    // ✅ 3) If vendor is blocked, no status updates allowed
    if (vendor.isBlocked) {
      return res.status(403).json({ error: 'Vendor is blocked. Status changes are not allowed. Contact SuperAdmin.' });
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
    // ✅ Step 1: Validate input using Joi
    const { error, value } = addFacilitiesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const facilitiesToAdd = value.facilities;

    // ✅ Step 2: Normalize names (trim + lowercase)
    const nameSet = new Set(facilitiesToAdd.map(f => f.name.trim().toLowerCase()));
    const classNameSet = new Set(facilitiesToAdd.map(f => f.class_name.trim().toLowerCase()));

    // ✅ Step 3: Check for existing facilities (case-insensitive)
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

    // ✅ Step 4: Create sanitized insert payload
    const newFacilities = facilitiesToAdd.map(facility => ({
      name: facility.name.trim(),
      class_name: facility.class_name.trim(),
      icon: facility.icon?.trim() || null
    }));

    // ✅ Step 5: Insert in transaction
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
