const HelpDeskInquiry = require('../models/HelpDeskInquiry');
const { helpDeskValidation } = require('../validationJoi/HelpDeskInquiry');

exports.submitInquiry = async (req, res) => {
  try {
    // ✅ Validate request body
    const { error, value } = helpDeskValidation.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(err => err.message)
      });
    }

    // ✅ Save inquiry without user field
    const inquiry = await HelpDeskInquiry.create(value);

    return res.status(201).json({
      success: true,
      message: 'Help desk inquiry submitted successfully.',
      data: inquiry
    });

  } catch (err) {
    console.error('[HelpDeskInquiry Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};


exports.getAllInquiries = async (req, res) => {
  try {
    // ✅ Optionally add pagination or filtering later
    const inquiries = await HelpDeskInquiry.find()
      .sort({ createdAt: -1 }); // Latest first

    if (!inquiries || inquiries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No help desk inquiries found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `${inquiries.length} inquiry(s) retrieved successfully.`,
      data: inquiries
    });
  } catch (err) {
    console.error('[GetAllInquiries Error]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
};