const Joi = require('joi');
const objectIdPattern = /^[0-9a-fA-F]{24}$/; // ✅ MongoDB ObjectId
const nameRegex = /^[A-Za-z]+(\s[A-Za-z]+)*$/;
const phoneRegex = /^[0-9]{10}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const onlyLetters = /^[A-Za-z\s]+$/;
const alphaNumericSpacePunctuation = /^[a-zA-Z0-9 .,'"()-]*$/;
const alphaSpace = /^[A-Za-z\s]+$/;
const numericOnly = /^[0-9]+$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Register Vendor 
exports.vendorRegistrationSchema = Joi.object({
  name: Joi.string()
    .pattern(nameRegex)
    .required()
    .messages({
      'string.empty': 'Name is required.',
      'string.pattern.base': 'Name must contain only letters and spaces between words.'
    }),

  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required.',
      'string.email': 'Email must be a valid email address.'
    }),

  phone: Joi.string()
    .pattern(phoneRegex)
    .required()
    .messages({
      'string.empty': 'Phone number is required.',
      'string.pattern.base': 'Phone number must be exactly 10 digits.'
    }),

  password: Joi.string()
    .pattern(passwordRegex)
    .required()
    .messages({
      'string.empty': 'Password is required.',
      'string.pattern.base': 'Password must be at least 8 characters and include letters, numbers, and a special character.'
    }),

  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password')) // ✅ must match password
    .messages({
      'any.only': 'Confirm Password must match Password.',
      'string.empty': 'Confirm Password is required.'
    }),

  aadhar_number: Joi.string()
    .pattern(/^[0-9]{12}$/)   // ✅ Ensures exactly 12 digits
    .required()
    .messages({
      'string.empty': 'Aadhar number is required.',
      'string.pattern.base': 'Aadhar number must be exactly 12 digits.'
    })
});

exports.verifyOtpSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).required()
    .messages({ "string.pattern.base": "Invalid email format." }),
  otp: Joi.string().length(6).required()
    .messages({ "string.length": "OTP must be 6 digits." })
});


exports.resendOtpSchema = Joi.object({
  email: Joi.string().pattern(emailPattern).required()
    .messages({ "string.pattern.base": "Invalid email format." })
});
// Forgot Password 

exports.forgotPasswordRequestSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Enter a valid email address.'
  })
}).unknown(false);

exports.verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required().messages({
    'string.empty': 'OTP is required.',
    'string.length': 'OTP must be 6 digits.'
  })
}).unknown(false);

exports. vendorLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Must be a valid email.'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required.'
  })
});

exports.changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'string.empty': 'Old password is required.'
  }),

  newPassword: Joi.string().pattern(passwordRegex).required().messages({
    'string.empty': 'New password is required.',
    'string.pattern.base': 'Password must be at least 8 characters and include letters, numbers, and a special character.'
  }),

  confirmPassword: Joi.any().equal(Joi.ref('newPassword')).required().messages({
    'any.only': 'Confirm password must match new password.',
    'any.required': 'Confirm password is required.'
  })
}).unknown(false);
const timePattern = /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM))$|^([01]?\d|2[0-3]):([0-5]\d)$/;


// Add Farm 


exports.farmAddValidationSchema = Joi.object({
  farmId: Joi.string().pattern(objectIdPattern).optional(),

  name: Joi.string().min(3).max(150).optional(),

  description: Joi.string().allow("", null).optional(),

farmCategory: Joi.array().items(
  Joi.string().pattern(objectIdPattern)
    .messages({ "string.pattern.base": "Each farmCategory ID must be a valid ObjectId." })
).optional()
  .messages({ "array.base": "farmCategory must be an array of ObjectIds." }),

  areaImages: Joi.array().items(
    Joi.object({
      areaType: Joi.string().trim().optional(),
      images: Joi.array().items(Joi.string().uri()).optional()
    })
  ).optional(),
rules: Joi.array().items(
  Joi.object({
    title: Joi.string().min(3).required()
      .messages({
        "string.empty": "Rule title is required.",
        "string.min": "Rule title must be at least 3 characters long."
      }),
    isActive: Joi.boolean().optional()
      .messages({ "boolean.base": "isActive must be true or false." })
  })
).optional()
  .messages({ "array.base": "Rules must be an array of objects." })
,

  propertyDetails: Joi.object({
    bhk: Joi.string().optional(),
    squareFeet: Joi.number().optional(),
    additionalInfo: Joi.string().allow("", null).optional()
  }).optional()
    .messages({ "object.base": "propertyDetails must be an object." }),

  location: Joi.object({
    address: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    pinCode: Joi.string().optional(),
    areaName: Joi.string().optional(),
    createdBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
  }).optional(),

  facilities: Joi.array().items(Joi.string().pattern(objectIdPattern)).optional(),

  capacity: Joi.number().min(1).optional(),
occupancy : Joi.number().min(1).optional(),
  bookingModes: Joi.array().items(
    Joi.string().valid("full_day", "day_slot", "night_slot")
  ).optional(),

  // ✅ Updated dailyPricing with optional timings
  dailyPricing: Joi.array().items(
    Joi.object({
      date: Joi.date().required()
        .messages({ "date.base": "Each dailyPricing item must have a valid date." }),

      slots: Joi.object({
        full_day: Joi.number().optional(),
        day_slot: Joi.number().optional(),
        night_slot: Joi.number().optional()
      }).required()
        .messages({ "object.base": "slots must be an object with pricing numbers." }),

      timings: Joi.object({
        full_day: Joi.object({
          checkIn: Joi.string().pattern(timePattern).required()
            .messages({ "string.pattern.base": "full_day.checkIn must be in HH:mm or hh:mm AM/PM format." }),
          checkOut: Joi.string().pattern(timePattern).required()
            .messages({ "string.pattern.base": "full_day.checkOut must be in HH:mm or hh:mm AM/PM format." })
        }).required(),
        day_slot: Joi.object({
          checkIn: Joi.string().pattern(timePattern).optional()
            .messages({ "string.pattern.base": "day_slot.checkIn must be in HH:mm or hh:mm AM/PM format." }),
          checkOut: Joi.string().pattern(timePattern).optional()
            .messages({ "string.pattern.base": "day_slot.checkOut must be in HH:mm or hh:mm AM/PM format." })
        }).optional(),
        night_slot: Joi.object({
          checkIn: Joi.string().pattern(timePattern).optional()
            .messages({ "string.pattern.base": "night_slot.checkIn must be in HH:mm or hh:mm AM/PM format." }),
          checkOut: Joi.string().pattern(timePattern).optional()
            .messages({ "string.pattern.base": "night_slot.checkOut must be in HH:mm or hh:mm AM/PM format." })
        }).optional()
      }).optional()
    })
  ).optional(),

  defaultPricing: Joi.object({
    full_day: Joi.number().optional(),
    day_slot: Joi.number().optional(),
    night_slot: Joi.number().optional()
  }).optional(),

  defaultTimings: Joi.object({
    full_day: Joi.object({
      checkIn: Joi.string().pattern(timePattern).required(),
      checkOut: Joi.string().pattern(timePattern).required()
    }).required(),
    day_slot: Joi.object({
      checkIn: Joi.string().pattern(timePattern).optional(),
      checkOut: Joi.string().pattern(timePattern).optional()
    }).optional(),
    night_slot: Joi.object({
      checkIn: Joi.string().pattern(timePattern).optional(),
      checkOut: Joi.string().pattern(timePattern).optional()
    }).optional()
  }).optional(),

  currency: Joi.string().optional(),

  images: Joi.array().items(Joi.string().uri()).optional(),

  unavailableDates: Joi.array().items(Joi.date()).optional(),

  isActive: Joi.boolean().optional(),
  isApproved: Joi.boolean().optional(),
  isHold: Joi.boolean().optional()
}).options({ abortEarly: false, allowUnknown: true });


// get farm 

exports.getVendorFarmsSchema = Joi.object({
  search: Joi.string().allow("").optional().default(""),
  status: Joi.string().allow("").valid("active", "inactive", "all", "").default("all"),
  page: Joi.alternatives()
    .try(Joi.number().integer().min(1), Joi.string().allow(""))
    .default(1)
    .custom((val) => (val === "" ? 1 : Number(val))),
  limit: Joi.alternatives()
    .try(Joi.number().integer().min(1).max(100), Joi.string().allow(""))
    .default(10)
    .custom((val) => (val === "" ? 10 : Number(val)))
});


exports.getFarmByVendorSchema = Joi.object({
  farmId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // ✅ Must be valid ObjectId format
    .messages({
      "any.required": "farmId is required",
      "string.pattern.base": "farmId must be a valid MongoDB ObjectId"
    })
});

// delete farm
exports.deleteVendorFarmSchema = Joi.object({
  farmId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "any.required": "farmId is required",
      "string.pattern.base": "farmId must be a valid MongoDB ObjectId"
    })
});


exports.getBookingByIdSchema = Joi.object({
  booking_id: Joi.number()
    .integer()
    .min(100000)
    .max(999999)
    .required()
    .messages({
      'number.base': 'booking_id must be a number',
      'number.min': 'booking_id must be a 6-digit number',
      'number.max': 'booking_id must be a 6-digit number',
      'any.required': 'booking_id is required'
    })
});
exports.getVendorBookingsSchema = Joi.object({
  status: Joi.string()
    .allow("")
    .valid("pending", "confirmed", "cancelled", "complete", "")
    .default(""), // ✅ empty means no filter

  search: Joi.string().allow("").optional().default(""),

  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),

  page: Joi.alternatives()
    .try(Joi.number().integer().min(1), Joi.string().allow(""))
    .default(1)
    .custom((val) => (val === "" ? 1 : Number(val))),

  limit: Joi.alternatives()
    .try(Joi.number().integer().min(1).max(100), Joi.string().allow(""))
    .default(10)
    .custom((val) => (val === "" ? 10 : Number(val)))
});


exports.updateFarmImagesSchema = Joi.object({
  farm_id: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      'string.pattern.base': 'Farm ID must be a valid MongoDB ObjectId.',
      'any.required': 'Farm ID is required.'
    })
}).options({ allowUnknown: true }); // allow file uploads