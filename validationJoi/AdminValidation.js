const Joi = require('joi');

// Password: min 8 chars, at least 1 letter, 1 number, 1 special char
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const phoneRegex = /^[0-9]{10}$/;


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

  permissions: Joi.array()
    .items(Joi.string())
    .default([]),

  isSuperAdmin: Joi.boolean().default(true)
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

  bookingId: Joi.string()
    .length(24)
    .hex()
    .optional()
    .allow('', null)
    .messages({
      'string.hex': 'Booking ID must be a valid hex string.',
      'string.length': 'Booking ID must be exactly 24 characters.'
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
});

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
