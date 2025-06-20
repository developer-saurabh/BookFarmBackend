const Vendor = require('../models/Vendor');

exports.addVenue = async (req, res) => {
  try {
    // ✅ 1) Joi validation
    const { error, value } = addVenueSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ error: error.details.map(e => e.message).join(', ') });
    }

    // ✅ 2) Pricing must have at least one non-null value
    const { fullDay, daySlot, nightSlot } = value.pricing;
    if ((fullDay == null || fullDay === 0) &&
        (daySlot == null || daySlot === 0) &&
        (nightSlot == null || nightSlot === 0)) {
      return res.status(400).json({ error: 'At least one pricing option must be provided.' });
    }

    // ✅ 3) Owner must exist
const owner = await Vendor.findById(value.owner);
    if (!owner) {
      return res.status(404).json({ error: 'Owner (vendor) not found.' });
    }
if (!owner.isVerified) {
  return res.status(403).json({ error: 'Vendor is not Verified to add venues.' });
}
    // ✅ 4) Duplicate name check
    const existing = await Venue.findOne({ name: value.name, owner: value.owner });
    if (existing) {
      return res.status(409).json({ error: 'A venue with this name already exists for this owner.' });
    }

    // ✅ 5) Check images exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image must be uploaded.' });
    }

    // ✅ 6) Prepare image URLs
    const images = req.files.map(file => file.path);

    // ✅ 7) Create Venue
    const venue = new Venue({
      ...value,
      type: 'venue',
      images,
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
