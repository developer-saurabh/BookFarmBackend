const Vendor = require('../models/VendorModel');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
// const sendAdminEmail = require('../utils/sendAdminEmail');
const {vendorRegistrationSchema} = require('../validationjoi/VendorValidation');

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



