const mongoose = require("mongoose");

const FarmhouseBookingSchema = new mongoose.Schema(
  {
    farmhouseName: { type: String, required: true }, // name of farmhouse
    bookingId: { type: Number, required: true, unique: false }, // unique booking number

    address: { type: String, required: true },
    dateOfRegistration: { type: Date, default: Date.now }, // when the booking was created

    guestName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    alternateMobileNumber: { type: String },

    numberOfGuests: { type: Number, required: true },

    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "pending",
    },

    bookingDate: { type: Date, required: true },

    slots: [
      {
        type: String,
        enum: ["full_day", "day_slot", "night_slot", "full_night"],
      },
    ],

   checkIn: { type: String },   // e.g., "10:00 AM"
    checkOut: { type: String },

    totalAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // 💰 discount on booking
    advancePaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },

    email: { type: String }, // optional
  },
  { timestamps: true }
);


module.exports = mongoose.model("AdminAdditionaModel", FarmhouseBookingSchema);