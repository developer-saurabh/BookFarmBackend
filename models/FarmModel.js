const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    pinCode: { type: String },
    areaName: { type: String, default: null }, // ✅ camelCase (consistent naming)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: false,
    },
  },
  { _id: false }
);

const ruleSchema = new mongoose.Schema(
  {
    title: { type: String, required: false, trim: true },

    isActive: { type: Boolean, default: true },
  },
  { _id: false }
); // No separate ID for each rule unless needed

const propertyDetailSchema = new mongoose.Schema(
  {
    bhk: { type: String, required: false }, // e.g., "3BHK"
    squareFeet: { type: Number, required: false }, // e.g., 1500
    additionalInfo: { type: String, default: null }, // optional notes
  },
  { _id: false }
);

const farmSchema = new mongoose.Schema(
  {
    // 🔑 Basic details
    name: { type: String, trim: true }, // optional
    description: { type: String },

    // 🔗 Farm Category (array but optional)
farmCategory: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FarmCategory",
    required: false
  }
],



    // 📸 Area-wise Images
    areaImages: [
      {
        areaType: { type: String, trim: true },
        images: [{ type: String }],
      },
    ],

    // 🔗 Rules
    rules: [ruleSchema],

    // 🔗 Property Details
    propertyDetails: propertyDetailSchema,

    location: addressSchema, // ✅ Embedded directly
    bookingModes: {
      type: [String],
      enum: ["full_day", "day_slot", "night_slot"],
      default: ["full_day"],
    },

dailyPricing: [
  {
    date: { type: Date },
    slots: {
      full_day: { type: Number, default: 0 },
      day_slot: { type: Number, default: 0 },
      night_slot: { type: Number, default: 0 },
    },
    timings: {    // ✅ Added timings object
      full_day: {
        checkIn: { type: String, default: "10:00" },
        checkOut: { type: String, default: "18:00" },
      },
      day_slot: {
        checkIn: { type: String, default: "10:00" },
        checkOut: { type: String, default: "15:00" },
      },
      night_slot: {
        checkIn: { type: String, default: "16:00" },
        checkOut: { type: String, default: "22:00" },
      }
    }
  },
],
defaultPricing: {
  full_day: { type: Number },
  day_slot: { type: Number },
  night_slot: { type: Number },
},
defaultTimings: {   // ✅ Add per-slot timings
  full_day: {
    checkIn: { type: String, default: "10:00" },
    checkOut: { type: String, default: "18:00" },
  },
  day_slot: {
    checkIn: { type: String, default: "10:00" },
    checkOut: { type: String, default: "15:00" },
  },
  night_slot: {
    checkIn: { type: String, default: "16:00" },
    checkOut: { type: String, default: "22:00" },
  }
},

    currency: { type: String, default: "INR" },

    // 📸 General Images
    images: [{ type: String }],

    facilities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm_Facility",
      },
    ],

    capacity: { type: Number, required: false }, // ✅ Now optional

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true, // owner should stay required
    },

unavailableDates: [
  {
    date: { type: Date, required: true },   // required ensures date must exist
    blockedSlots: {
      type: [String],
      enum: ["full_day", "day_slot", "night_slot"],
      default: ["full_day"]
    }
  }
],


    // 📊 Status
    isActive: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    isHold: { type: Boolean, default: false },
     // 🔥 NEW FIELDS
    currentStep: { type: Number, default: 1 },
    isDraft: { type: Boolean, default: true },
    completedSteps: { type: [Number], default: [] }
  },
  
  { timestamps: true }
);

module.exports = mongoose.model("Farm", farmSchema);
