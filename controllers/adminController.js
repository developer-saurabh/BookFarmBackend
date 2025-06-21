const Admin = require('../models/AdminModel');
const bcrypt = require('bcryptjs');
const {adminRegisterSchema} = require('../validationJoi/AdminValidation');
const Vendor = require('../models/VendorModel');
const {updateVendorStatusSchema} = require('../validationJoi/AdminValidation');


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