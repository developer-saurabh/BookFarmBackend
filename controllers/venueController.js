const Vendor = require('../models/VendorModel');
const Venue = require('../models/VenueModel');
const { uploadFilesToCloudinary } = require('../utils/UploadFile');
const { addVenueSchema } = require('../validationjoi/VendorValidation');


exports.addVenue = async (req, res) => {
  try {
    // ✅ 1) Joi validation
    const { error, value } = addVenueSchema.validate(req.body, { abortEarly: false });
    console.log("req.body",req.body)
    console.log("req.files printing",req.files)
    if (error) {
      return res.status(400).json({ error: error.details.map(e => e.message).join(', ') });
    }

    // ✅ 2) Use vendor ID from JWT/session instead of trusting body
    const vendorId = req.user.id; // ✅ comes from your auth middleware

    // ✅ 3) Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found.' });
    }

    // ✅ 4) Vendor must be verified, active, not blocked
    if (!vendor.isVerified) {
      return res.status(403).json({ error: 'Vendor is not verified to add venues.' });
    }
    if (!vendor.isActive) {
      return res.status(403).json({ error: 'Vendor is not active to add venues.' });
    }
    if (vendor.isBlocked) {
      return res.status(403).json({ error: 'Vendor is blocked and cannot add venues.' });
    }

    // ✅ 5) Check duplicate venue name for same vendor
    const existing = await Venue.findOne({ name: value.name, owner: value.owner });
    if (existing) {
      return res.status(409).json({ error: 'A venue with this name already exists for this vendor.' });
    
    }   
   
    console.log("req.files printing:", req.files);

    // ✅ 6) SAFELY check for image or images key
    const uploaded = req.files?.images || req.files?.image;
    if (!uploaded) {
      return res.status(400).json({ error: 'At least one image must be uploaded.' });
    }

    // ✅ 7) Normalize to array
    const images = Array.isArray(uploaded) ? uploaded : [uploaded];
    // console.log("Normalized files:", images.map(f => f.name));

    // ✅ 8) Use util to store in ./Media/venues
 const cloudUrls = await uploadFilesToCloudinary(images, 'venues');
    // ✅ 8) Create Venue — link to Vendor properly
    const venue = new Venue({
      ...value,
      type: 'venue',  
      images:cloudUrls,
      owner: vendor._id,
      isActive: true,
      isApproved: false
    });

    await venue.save();

    return res.status(201).json({
      message: '✅ Venue created successfully!',
      venue
    });

  } catch (err) {
    console.error('🚨 Error adding venue:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

