const Vendor = require('../models/VendorModel');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const sendAdminEmail = require('../utils/sendAdminEmail');
const {vendorRegistrationSchema,vendorLoginSchema} = require('../validationJoi/VendorValidation');


exports.registerVendor = async (req, res) => {
  try {
    // ✅ 1) Validate input with Joi
    const { error, value } = vendorRegistrationSchema.validate(req.body);
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
    const { error, value } = vendorLoginSchema.validate(req.body);
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
