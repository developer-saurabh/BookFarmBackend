const Venue = require('../models/VenueModel');

// Only business logic
exports.addVenue = async (req, res) => {
  try {
    const { name, type, location, capacity } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded!' });
    }

    const imageUrls = req.files.map(file => file.path);

    const venue = new Venue({
      name,
      type,
      location,
      capacity,
      images: imageUrls,
    });

    await venue.save();

    res.status(201).json({
      success: true,
      data: venue,
    });

  } catch (error) {
    console.error('❌ Error adding venue:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
