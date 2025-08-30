const FarmhouseBooking = require("../models/AdminAdditionalModel");
const { farmhouseBookingValidationSchema } = require("../validationJoi/adminValidation/AdminAdditionaInformation");

exports.createBooking = async (req, res) => {
  try {
    // ✅ Joi validation
    const { error, value } = farmhouseBookingValidationSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((e) => e.message),
      });
    }

    // ✅ Create booking with all fields (value contains cleaned request data)
    const booking = new FarmhouseBooking(value);

    // ✅ Save to DB
    await booking.save();

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (err) {
    console.error("[Booking Error]", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      error: err.message,
    });
  }
};



// Update booking by MongoDB _id or bookingId
exports.updateBooking = async (req, res) => {
  try {
    const { id, bookingId } = req.body; // pass either _id or bookingId
    const updateData = req.body.updateData; // object containing fields to update

    if (!id && !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Please provide either MongoDB _id or bookingId to update",
      });
    }

    // Build query based on which identifier is provided
    const query = id ? { _id: id } : { bookingId: bookingId };

    const updatedBooking = await FarmhouseBooking.findOneAndUpdate(
      query,
      updateData,
      { new: true } // return the updated document
    );

    if (!updatedBooking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: updatedBooking,
    });
  } catch (error) {
    console.error("[Update Booking Error]", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating booking",
      error: error.message,
    });
  }
};



// Get booking by _id or bookingId
exports.getBooking = async (req, res) => {
  try {
    const { id, bookingId } = req.body; // pass either as query parameter

    if (!id && !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Please provide either MongoDB _id or bookingId",
      });
    }

    const query = id ? { _id: id } : { bookingId: bookingId };

    const booking = await FarmhouseBooking.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("[Get Booking Error]", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching booking",
      error: error.message,
    });
  }
};


exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await FarmhouseBooking.find().sort({ bookingDate: -1 }); // latest bookings first

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("[Get All Bookings Error]", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching all bookings",
      error: error.message,
    });
  }
};