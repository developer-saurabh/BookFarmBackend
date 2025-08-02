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


exports.farmAddValidationSchema = Joi.object({
  farmId: Joi.string().pattern(objectIdPattern).optional(),

  name: Joi.string().min(3).max(150).optional(),

  description: Joi.string().allow("", null).optional(),

farmCategory_id: Joi.string().pattern(objectIdPattern).optional()
  .messages({
    "string.pattern.base": "farmCategory must be a valid ObjectId."
  }),

  areaImages: Joi.array().items(
    Joi.object({
      areaType: Joi.string().trim().optional(),
      images: Joi.array().items(Joi.string().uri()).optional()
    })
  ).optional(),
rules: Joi.array().items(
  Joi.object({
    title: Joi.string().min(3).max(200).required()
      .messages({
        "string.empty": "Rule title is required.",
        "string.min": "Rule title must be at least 3 characters long.",
        "string.max": "Rule title cannot exceed 200 characters."
      }),
 
    isActive: Joi.boolean().optional()
      .messages({
        "boolean.base": "isActive must be true or false."
      })
  })
).optional()
  .messages({
    "array.base": "Rules must be an array of objects."
  }),
propertyDetails: Joi.object({
  bhk: Joi.string().optional().messages({
    "string.base": "BHK must be a string."
  }),
  squareFeet: Joi.number().optional().messages({
    "number.base": "SquareFeet must be a number."
  }),
  additionalInfo: Joi.string().allow("", null).optional().messages({
    "string.base": "Additional Info must be a string."
  })
}).optional()
  .messages({
    "object.base": "propertyDetails must be an object."
  }),
address: Joi.object({
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  pinCode: Joi.string().optional(),
  areaName: Joi.string().optional(),
  createdBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
}).optional(),


  facilities: Joi.array().items(Joi.string().pattern(objectIdPattern)).optional(),

  capacity: Joi.number().min(1).optional(),

  bookingModes: Joi.array().items(
    Joi.string().valid("full_day", "day_slot", "night_slot")
  ).optional(),

  dailyPricing: Joi.array().items(
    Joi.object({
      date: Joi.date().optional(),
      slots: Joi.object({
        full_day: Joi.number().optional(),
        day_slot: Joi.number().optional(),
        night_slot: Joi.number().optional(),
      }).optional(),
      checkIn: Joi.string().optional(),
      checkOut: Joi.string().optional(),
    })
  ).optional(),

  defaultPricing: Joi.object({
    full_day: Joi.number().optional(),
    day_slot: Joi.number().optional(),
    night_slot: Joi.number().optional(),
  }).optional(),

  defaultCheckIn: Joi.string().optional(),
  defaultCheckOut: Joi.string().optional(),

  currency: Joi.string().optional(),

  images: Joi.array().items(Joi.string().uri()).optional(),

  unavailableDates: Joi.array().items(Joi.date()).optional(),

  isActive: Joi.boolean().optional(),
  isApproved: Joi.boolean().optional(),
  isHold: Joi.boolean().optional()
}).options({ abortEarly: false, allowUnknown: true });

exports.updateFarmImagesSchema = Joi.object({
  farm_id: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      'string.pattern.base': 'Farm ID must be a valid MongoDB ObjectId.',
      'any.required': 'Farm ID is required.'
    })
}).options({ allowUnknown: true }); // allow file uploads