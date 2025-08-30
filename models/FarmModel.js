const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    pinCode: { type: String },
    areaName: { type: String, default: null },
  mapLink: { type: String },
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
);

const propertyDetailSchema = new mongoose.Schema(
  {
    bhk: { type: String, required: false },
    squareFeet: { type: Number, required: false },
    additionalInfo: { type: String, default: null },
  },
  { _id: false }
);

const farmSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String },

    farmCategory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FarmCategory",
        required: false,
      },
    ],
    types: [{ type: mongoose.Schema.Types.ObjectId, ref: "Types" }],

    areaImages: [
      {
        areaType: { type: String, trim: true },
        images: [{ type: String }],
      },
    ],

    rules: [ruleSchema],
    propertyDetails: propertyDetailSchema,
    location: addressSchema,

    // 🔁 MODES: added full_night everywhere
    bookingModes: {
      full_day: { type: Boolean, default: false },
      day_slot: { type: Boolean, default: false },
      night_slot: { type: Boolean, default: false },
      full_night: { type: Boolean, default: false },
    },
    barbequeCharcoal: {
      isAvailable: { type: Boolean, default: false }, // overall toggle
      slots: {
        full_day: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
        },
        day_slot: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
        },
        night_slot: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
        },
        full_night: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
        },
      },
    },
    kitchenOffered: {
      isAvailable: { type: Boolean, default: false }, // overall toggle
      slots: {
        full_day: {
          isAvailable: { type: Boolean, default: false }, // per slot toggle
          price: { type: Number, default: 0 },
          description: { type: String, default: "" },
        },
        day_slot: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
          description: { type: String, default: "" },
        },
        night_slot: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
          description: { type: String, default: "" },
        },
        full_night: {
          isAvailable: { type: Boolean, default: false },
          price: { type: Number, default: 0 },
          description: { type: String, default: "" },
        },
      },
    },
    mealsOffered: {
      full_day: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          lunch: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          hi_tea: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          dinner: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
        },
      },
      day_slot: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          lunch: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          hi_tea: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          dinner: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
        },
      },
      night_slot: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          lunch: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          hi_tea: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          dinner: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
        },
      },
      full_night: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          lunch: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          hi_tea: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
          dinner: {
            isAvailable: { type: Boolean, default: false },
            value: { type: [String], default: [] },
          },
        },
      },
    },

dailyPricing: [
  {
    date: { type: Date, required: true },

    slots: {
      full_day: { price: { type: Number, default: 0 }, pricePerGuest: { type: Number, default: 0 } },
      day_slot: { price: { type: Number, default: 0 }, pricePerGuest: { type: Number, default: 0 } },
      night_slot: { price: { type: Number, default: 0 }, pricePerGuest: { type: Number, default: 0 } },
      full_night: { price: { type: Number, default: 0 }, pricePerGuest: { type: Number, default: 0 } },
    },

    timings: {
      full_day: { checkIn: { type: String, default: "10:00 AM" }, checkOut: { type: String, default: "06:00 PM" } },
      day_slot: { checkIn: { type: String, default: "10:00 AM" }, checkOut: { type: String, default: "03:00 PM" } },
      night_slot: { checkIn: { type: String, default: "04:00 PM" }, checkOut: { type: String, default: "07:00 PM" } },
      full_night: { checkIn: { type: String, default: "07:01 PM" }, checkOut: { type: String, default: "08:00 AM" } },
    },

    kitchenOffered: {
      full_day: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 }, description: { type: String, default: "" } },
      day_slot: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 }, description: { type: String, default: "" } },
      night_slot: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 }, description: { type: String, default: "" } },
      full_night: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 }, description: { type: String, default: "" } },
    },
    kitchenOfferedActive: { type: Boolean, default: false },

    barbequeCharcoal: {
      full_day: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
      day_slot: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
      night_slot: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
      full_night: { isAvailable: { type: Boolean, default: false }, price: { type: Number, default: 0 } },
    },
    barbequeCharcoalActive: { type: Boolean, default: false },

    mealsOffered: {
      full_day: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          lunch: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          hi_tea: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          dinner: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
        }
      },
      day_slot: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          lunch: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          hi_tea: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          dinner: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
        }
      },
      night_slot: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          lunch: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          hi_tea: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          dinner: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
        }
      },
      full_night: {
        isOffered: { type: Boolean, default: false },
        meals: {
          breakfast: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          lunch: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          hi_tea: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
          dinner: { isAvailable: { type: Boolean, default: false }, value: { type: [String], default: [] } },
        }
      },
    },
    mealsOfferedActive: { type: Boolean, default: false },
  }
]
,

 defaultPricing: {
  full_day: { 
    price: { type: Number, default: 0 },         // existing total/default price
    pricePerGuest: { type: Number, default: 0 }  // new field
  },
  day_slot: { 
    price: { type: Number, default: 0 }, 
    pricePerGuest: { type: Number, default: 0 } 
  },
  night_slot: { 
    price: { type: Number, default: 0 }, 
    pricePerGuest: { type: Number, default: 0 } 
  },
  full_night: { 
    price: { type: Number, default: 0 }, 
    pricePerGuest: { type: Number, default: 0 } 
  }, 
},

    defaultTimings: {
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
      },
      full_night: {
        // NEW
        checkIn: { type: String, default: "20:00" },
        checkOut: { type: String, default: "08:00" },
      },
    },

    currency: { type: String, default: "INR" },
    images: [{ type: String }],

    facilities: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Farm_Facility" },
    ],
    occupancy: { type: Number, required: false },
    capacity: { type: Number, required: false },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    unavailableDates: [
      {
        date: { type: Date, required: true },
        blockedSlots: {
          type: [String],
          enum: ["full_day", "day_slot", "night_slot", "full_night"], // NEW
          default: ["full_day"],
        },
      },
    ],

    isActive: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    isHold: { type: Boolean, default: false },

    currentStep: { type: Number, default: 1 },
    isDraft: { type: Boolean, default: true },
    completedSteps: { type: [Number], default: [] },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Farm", farmSchema);
