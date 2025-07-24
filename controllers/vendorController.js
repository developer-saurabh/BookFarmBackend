const Vendor = require('../models/VendorModel');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const FarmCategory=require("../models/FarmCategory")
const Facility=require("../models/FarmFacility")
const VendorValiidation= require('../validationJoi/VendorValidation');
// const sendAdminEmail = require('../utils/sendAdminEmail');



exports.registerVendor = async (req, res) => {
  try {
    // ✅ 1) Validate input with Joi
    const { error, value } = VendorValiidation.vendorRegistrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ 2) Check for duplicate email
    const existingEmail = await Vendor.findOne({ email: value.email });
    if (existingEmail) {
      return res.status(409).json({ error: 'A vendor with this email already exists.' });
    }

    // ✅ 3) Check for duplicate phone
    const existingPhone = await Vendor.findOne({ phone: value.phone });
    if (existingPhone) {
      return res.status(409).json({ error: 'A vendor with this phone number already exists.' });
    }

    // ✅ 4) Hash password securely
    const hashedPassword = await bcrypt.hash(value.password, 10);

    // ✅ 5) Save vendor
    const vendor = new Vendor({
      name: value.name,
      email: value.email,
      phone: value.phone,
      password: hashedPassword,
      businessName: value.businessName,
     
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
    // ✅ 5) Generate JWT
    const token = jwt.sign(
      { id: vendor._id, email: vendor.email, role: 'vendor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.setHeader('Authorization', `Bearer ${token}`);
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

    // ✅ Validate single farm category ID
    const validFarmCategory = await FarmCategory.findById(value.farmCategory);
    if (!validFarmCategory) {
      return res.status(400).json({ error: 'Invalid farm category selected.' });
    }

    // ✅ Validate facilities if present
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

    // 🔁 Validate dailyPricing uniqueness (no duplicate dates)
    if (value.dailyPricing && Array.isArray(value.dailyPricing)) {
      const seenDates = new Set();
      for (const entry of value.dailyPricing) {
        const isoDate = new Date(entry.date).toISOString().slice(0, 10);
        if (seenDates.has(isoDate)) {
          return res.status(400).json({
            error: `Duplicate pricing found for date: ${isoDate}`
          });
        }
        seenDates.add(isoDate);
      }
    }

    const newFarm = await new Farm(value).save();

    // 🧠 Populate references
    const populatedFarm = await Farm.findById(newFarm._id)
      .populate('farmCategory')
      .populate('facilities');

    return res.status(201).json({
      message: 'Farm added successfully',
      data: populatedFarm
    });

  } catch (err) {
    console.error('[AddFarm Error]', err);
    return res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};