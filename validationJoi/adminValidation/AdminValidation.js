const Joi = require('joi');
const mongoose = require("mongoose");
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const phoneRegex = /^[0-9]{10}$/;
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

exports.sendOtpSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Email must be valid.'
  })
}).unknown(false);

exports. adminRegisterSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[A-Za-z]+(\s[A-Za-z]+)*$/)
    .required()
    .messages({
      'string.empty': 'Name is required.',
      'string.pattern.base': 'Name must contain only letters and spaces.'
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



  isSuperAdmin: Joi.boolean().default(true),
   otp: Joi.string()
    .length(6)
    .required()
    .messages({
      'string.empty': 'OTP is required.',
      'string.length': 'OTP must be 6 digits.'
    }),
      address: Joi.string()    // ✅ Added Address Validation
    .min(5)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Address is required.',
      'string.min': 'Address must be at least 5 characters long.',
      'string.max': 'Address must not exceed 200 characters.'
    })
});

exports. adminLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email is required.',
      'string.email': 'Enter a valid email address.'
    }),

  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.empty': 'Password is required.',
      'string.min': 'Password must be at least 8 characters.'
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


exports.resetPasswordSchema = Joi.object({

  newPassword: Joi.string().pattern(passwordRegex).required().messages({
    'string.empty': 'New password is required.',
    'string.pattern.base': 'Password must be at least 8 characters and include letters, numbers, and a special character.'
  }),
  confirmPassword: Joi.any().equal(Joi.ref('newPassword')).required().messages({
    'any.only': 'Confirm password must match new password.',
    'any.required': 'Confirm password is required.'
  })
}).unknown(false);


exports. updateVendorStatusSchema = Joi.object({

   vendor_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.empty': 'vendor_id is required.',
      'string.pattern.base': 'vendor_id must be a valid MongoDB ObjectId.'
    }),
  isActive: Joi.boolean()
    .messages({
      'boolean.base': 'isActive must be a boolean value.'
    }),

  isVerified: Joi.boolean()
    .messages({
      'boolean.base': 'isVerified must be a boolean value.'
    }),

  isBlocked: Joi.boolean()
    .messages({
      'boolean.base': 'isBlocked must be a boolean value.'
    })
}).or('isActive', 'isVerified', 'isBlocked')
  .messages({
    'object.missing': 'At least one of isActive, isVerified, or isBlocked must be provided.'
  });

// Get All Bookings Schema


exports. getAllBookingsSchema = Joi.object({
  page: Joi.alternatives()
    .try(Joi.number().integer().min(1), Joi.string().regex(/^\d+$/))
    .optional()
    .allow('', null)
    .messages({
      'number.base': 'Page must be a number.',
      'number.integer': 'Page must be an integer.',
      'number.min': 'Page must be at least 1.',
      'string.pattern.base': 'Page must be a numeric string.'
    }),

  limit: Joi.alternatives()
    .try(Joi.number().integer().min(1).max(100), Joi.string().regex(/^\d+$/))
    .optional()
    .allow('', null)
    .messages({
      'number.base': 'Limit must be a number.',
      'number.integer': 'Limit must be an integer.',
      'number.min': 'Limit must be at least 1.',
      'number.max': 'Limit cannot exceed 100.',
      'string.pattern.base': 'Limit must be a numeric string.'
    }),
bookingId: Joi.alternatives().try(
    Joi.number().integer().min(100000).max(999999),
    Joi.string().valid('')
  )
  .optional()
  .allow(null)
  .messages({
    'number.base': 'Booking ID must be a number.',
    'number.min': 'Booking ID must be a 6-digit number.',
    'number.max': 'Booking ID must be a 6-digit number.'
  }),

  date: Joi.date()
    .iso()
    .optional()
    .allow('', null)
    .messages({
      'date.base': 'Date must be a valid date.',
      'date.format': 'Date must follow ISO format (YYYY-MM-DD).'
    }),

  booking_source_type: Joi.string()
    .valid('website', 'whatsapp')
    .optional()
    .allow('', null)
    .messages({
      'any.only': 'Booking source must be either "website" or "whatsapp".',
      'string.base': 'Booking source must be a string.'
    })
}).unknown(true);;

exports. customerQuerySchema = Joi.object({
  search: Joi.string().allow('').optional(),

  isBlacklisted: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid('true', 'false', ''))
    .optional()
    .custom((value, helpers) => {
      if (value === '') return undefined;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }),

  sortBy: Joi.string()
    .valid('name', 'email', 'phone', 'createdAt', 'updatedAt', '')
    .default('createdAt')
    .custom((value) => (value === '' ? 'createdAt' : value)),

  sortOrder: Joi.string()
    .valid('asc', 'desc', '')
    .default('desc')
    .custom((value) => (value === '' ? 'desc' : value)),

  page: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom((value) => {
      const parsed = parseInt(value);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    })
    .default(1),

  limit: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom((value) => {
      const parsed = parseInt(value);
      return isNaN(parsed) || parsed < 1 ? 10 : parsed;
    })
    .default(10)
});

exports. vendorQuerySchema = Joi.object({
  search: Joi.string().allow('').optional(),

  sortBy: Joi.string()
    .valid('name', 'email', 'phone', 'createdAt', 'updatedAt', '')
    .custom((v) => (v === '' ? 'createdAt' : v))
    .default('createdAt'),

  sortOrder: Joi.string()
    .valid('asc', 'desc', '')
    .custom((v) => (v === '' ? 'desc' : v))
    .default('desc'),

  page: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom((v) => {
      const parsed = parseInt(v);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    })
    .default(1),

  limit: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom((v) => {
      const parsed = parseInt(v);
      return isNaN(parsed) || parsed < 1 ? 10 : parsed;
    })
    .default(10)
});

exports. getProfileSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.empty': 'Admin ID is required.',
      'string.pattern.base': 'Admin ID must be a valid MongoDB ObjectId.'
    })
});

exports. approvedVendorQuerySchema = Joi.object({
  sortBy: Joi.string()
    .valid('name', 'email', 'phone', 'createdAt', 'updatedAt', '')
    .custom(v => (v === '' ? 'createdAt' : v))
    .default('createdAt'),

  sortOrder: Joi.string()
    .valid('asc', 'desc', '')
    .custom(v => (v === '' ? 'desc' : v))
    .default('desc'),

  page: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom(val => {
      const parsed = parseInt(val);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    })
    .default(1),

  limit: Joi.alternatives()
    .try(Joi.string().allow(''), Joi.number())
    .custom(val => {
      const parsed = parseInt(val);
      return isNaN(parsed) || parsed < 1 ? 10 : parsed;
    })
    .default(10)
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

exports.getVendorByIdSchema = Joi.object({
  vendor_id: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      'string.base': 'Vendor ID must be a string.',
      'string.empty': 'Vendor ID is required.',
      'string.pattern.base': 'Vendor ID must be a valid MongoDB ObjectId.',
      'any.required': 'Vendor ID is required.'
    })
}).options({ allowUnknown: false }); 

exports.getAllFarmsSchema = Joi.object({
  city: Joi.string().optional().allow('').messages({
    'string.base': 'City must be a string.'
  }),
  state: Joi.string().optional().allow('').messages({
    'string.base': 'State must be a string.'
  }),
  isActive: Joi.boolean().optional().messages({
    'boolean.base': 'isActive must be a boolean value.'
  }),
  category: Joi.string().pattern(objectIdRegex).optional().allow('').messages({
    'string.pattern.base': 'Category must be a valid ObjectId.'
  }),
  page: Joi.alternatives().try(
    Joi.number().integer().min(1),
    Joi.string().allow('').empty('').default(1)
  ).default(1).messages({
    'number.base': 'Page must be a number.'
  }),
  limit: Joi.alternatives().try(
    Joi.number().integer().min(1).max(100),
    Joi.string().allow('').empty('').default(10)
  ).default(10).messages({
    'number.base': 'Limit must be a number.',
    'number.max': 'Limit cannot exceed 100.'
  })
}).options({ allowUnknown: true });

exports.updateFarmStatusSchema = Joi.object({
  farm_id: Joi.string()
    .pattern(objectIdRegex)
    .required()
    .messages({
      'string.pattern.base': 'Farm ID must be a valid MongoDB ObjectId.',
      'any.required': 'Farm ID is required.'
    }),
  isActive: Joi.boolean().optional().messages({
    'boolean.base': 'isActive must be a boolean value.'
  }),
  isApproved: Joi.boolean().optional().messages({
    'boolean.base': 'isApproved must be a boolean value.'
  }),
  isHold: Joi.boolean().optional().messages({
    'boolean.base': 'isHold must be a boolean value.'
  })
})
  .or('isActive', 'isApproved', 'isHold') // At least one field must be provided
  .messages({
    'object.missing': 'At least one status field (isActive, isApproved, or isHold) must be provided.'
  })
  .options({ allowUnknown: false });

  // udpate admin profile

  exports.getFarmByVendorSchema = Joi.object({
    farmId: Joi.string()
      .required()
      .pattern(/^[0-9a-fA-F]{24}$/) // ✅ Must be valid ObjectId format
      .messages({
        "any.required": "farmId is required",
        "string.pattern.base": "farmId must be a valid MongoDB ObjectId"
      })
  });

exports.adminUpdateSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[A-Za-z]+(\s[A-Za-z]+)*$/)
    .optional()
    .messages({
      'string.pattern.base': 'Name must contain only letters and spaces.'
    }),

  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Email must be a valid email address.'
    }),

  phone: Joi.string()
    .pattern(phoneRegex)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be exactly 10 digits.'
    }),

  address: Joi.string()
    .min(5)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Address must be at least 5 characters long.',
      'string.max': 'Address must not exceed 200 characters.'
    })
});

// Notification 
exports. vendorNotificationSchema = Joi.object({
  vendorIds: Joi.array()
    .items(
      Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error("any.invalid");
        }
        return value;
      }, "Mongo ObjectId Validation")
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Vendor IDs must be an array.",
      "array.min": "At least one vendor ID is required.",
      "any.invalid": "Invalid vendor ID format.",
      "any.required": "Vendor IDs are required.",
    }),
});