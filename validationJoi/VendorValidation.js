const Joi = require('joi');

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


exports. farmAddValidationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.base': 'Farm name must be a string.',
      'string.empty': 'Farm name is required.',
      'string.min': 'Farm name must be at least 3 characters long.',
      'string.max': 'Farm name cannot exceed 100 characters.'
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters.'
    }),


farmCategory: Joi.alternatives().try(
  Joi.string().hex().length(24),
  Joi.array().items(Joi.string().hex().length(24))
).required().messages({
  'string.hex': 'Each farm category ID must be a valid ObjectId.',
  'string.length': 'Each farm category ID must be 24 characters.',
  'array.base': 'Farm category must be an array of valid ObjectIds.',
  'any.required': 'Farm category is required.'
}),

  location: Joi.object({
    address: Joi.string().min(5).max(200).required().messages({
      'string.empty': 'Address is required.',
      'string.min': 'Address must be at least 5 characters.',
      'string.max': 'Address cannot exceed 200 characters.'
    }),
    city: Joi.string().pattern(/^[a-zA-Z\s]+$/).min(2).max(100).required().messages({
      'string.empty': 'City is required.',
      'string.pattern.base': 'City can only contain letters and spaces.',
      'string.min': 'City must be at least 2 characters.',
      'string.max': 'City cannot exceed 100 characters.'
    }),
    state: Joi.string().pattern(/^[a-zA-Z\s]+$/).min(2).max(100).required().messages({
      'string.empty': 'State is required.',
      'string.pattern.base': 'State can only contain letters and spaces.',
      'string.min': 'State must be at least 2 characters.',
      'string.max': 'State cannot exceed 100 characters.'
    }),
    pinCode: Joi.string().pattern(/^\d{6}$/).optional().messages({
      'string.pattern.base': 'Pin code must be a valid 6-digit number.'
    }),
    mapLink: Joi.string().uri().optional().allow('').messages({
      'string.uri': 'Map link must be a valid URL.'
    })
  }).required().messages({
    'object.base': 'Location must be a valid object.',
    'any.required': 'Location is required.'
  }),

  bookingModes: Joi.array()
    .items(Joi.string().valid('full_day', 'day_slot', 'night_slot'))
    .default(['full_day'])
    .messages({
      'array.base': 'Booking modes must be an array.',
      'any.only': 'Each booking mode must be full_day, day_slot, or night_slot.'
    }),

  defaultPricing: Joi.object({
    full_day: Joi.number().min(0).optional().messages({
      'number.base': 'Full day price must be a number.',
      'number.min': 'Full day price must be zero or greater.'
    }),
    day_slot: Joi.number().min(0).optional().messages({
      'number.base': 'Day slot price must be a number.',
      'number.min': 'Day slot price must be zero or greater.'
    }),
    night_slot: Joi.number().min(0).optional().messages({
      'number.base': 'Night slot price must be a number.',
      'number.min': 'Night slot price must be zero or greater.'
    })
  }).required().messages({
    'object.base': 'Default pricing must be a valid object.',
    'any.required': 'Default pricing is required.'
  }),

  // ✅ Updated dailyPricing with checkIn & checkOut
  dailyPricing: Joi.array().items(
    Joi.object({
      date: Joi.date().iso().required().messages({
        'date.base': 'Each daily pricing date must be a valid ISO date.',
        'any.required': 'Date is required for each pricing entry.'
      }),
      slots: Joi.object({
        full_day: Joi.number().min(0).optional().messages({
          'number.base': 'Full day slot price must be a number.',
          'number.min': 'Full day slot price must be zero or more.'
        }),
        day_slot: Joi.number().min(0).optional().messages({
          'number.base': 'Day slot price must be a number.',
          'number.min': 'Day slot price must be zero or more.'
        }),
        night_slot: Joi.number().min(0).optional().messages({
          'number.base': 'Night slot price must be a number.',
          'number.min': 'Night slot price must be zero or more.'
        })
      }).required().messages({
        'object.base': 'Slots must be a valid object.',
        'any.required': 'Slots object is required.'
      }),
   checkIn: Joi.string()
  .pattern(/^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i)
  .optional()
  .messages({
    'string.pattern.base': 'checkIn must be in hh:mm AM/PM format (e.g., 10:00 AM).'
  }),

checkOut: Joi.string()
  .pattern(/^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i)
  .optional()
  .messages({
    'string.pattern.base': 'checkOut must be in hh:mm AM/PM format (e.g., 07:30 PM).'
  }),
    })
  ).optional().messages({
    'array.base': 'Daily pricing must be an array of date-slot objects.'
  }),

  currency: Joi.string().valid('INR', 'USD', 'EUR').default('INR').messages({
    'any.only': 'Currency must be INR, USD, or EUR.'
  }),

    facilities: Joi.array().items(Joi.string().hex().length(24).messages({
      'string.hex': 'Each facility ID must be a valid ObjectId.',
      'string.length': 'Each facility ID must be 24 characters.'
    })).optional().messages({
      'array.base': 'Facilities must be an array of valid IDs.'
    }),

  capacity: Joi.number().min(1).required().messages({
    'number.base': 'Capacity must be a number.',
    'number.min': 'Capacity must be at least 1.',
    'any.required': 'Capacity is required.'
  }),

  currency: Joi.string()
    .valid('INR', 'USD', 'EUR')
    .default('INR')
    .messages({
      'any.only': 'Currency must be INR, USD, or EUR.'
    }),

  facilities: Joi.array()
    .items(Joi.string().hex().length(24).messages({
      'string.hex': 'Each facility ID must be a valid ObjectId.',
      'string.length': 'Each facility ID must be 24 characters.'
    }))
    .optional()
    .messages({
      'array.base': 'Facilities must be an array of valid IDs.'
    }),

  capacity: Joi.number()
    .min(1)
    .required()
    .messages({
      'number.base': 'Capacity must be a number.',
      'number.min': 'Capacity must be at least 1.',
      'any.required': 'Capacity is required.'
    })
}).options({
  abortEarly: false,
  allowUnknown: false,
});;


exports.updateFarmImagesSchema = Joi.object({
  farm_id: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      'string.pattern.base': 'Farm ID must be a valid MongoDB ObjectId.',
      'any.required': 'Farm ID is required.'
    })
}).options({ allowUnknown: true }); // allow file uploads