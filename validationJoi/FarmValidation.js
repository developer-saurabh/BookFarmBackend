// validators/booking.validator.js
const Joi = require('joi');

exports.monthYearSchema = Joi.object({
  monthYear: Joi.string()
    .pattern(/^\d{2}\/\d{4}$/)
    .required()
    .messages({
      'string.pattern.base': 'monthYear must be in MM/YYYY format',
      'any.required': 'monthYear is required'
    })
});


exports.farmAddValidationSchema = Joi.object({
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

  type: Joi.string()
    .valid('Organic Farm', 'Event Farm', 'Resort Farm', 'Other')
    .required()
    .messages({
      'any.only': 'Type must be one of Organic Farm, Event Farm, Resort Farm, or Other.',
      'any.required': 'Farm type is required.'
    }),

  location: Joi.object({
    address: Joi.string()
      .min(5)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Address is required.',
        'string.min': 'Address must be at least 5 characters.',
        'string.max': 'Address cannot exceed 200 characters.'
      }),
    city: Joi.string()
      .pattern(/^[a-zA-Z\s]+$/)
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.empty': 'City is required.',
        'string.pattern.base': 'City can only contain letters and spaces.',
        'string.min': 'City must be at least 2 characters.',
        'string.max': 'City cannot exceed 100 characters.'
      }),
    state: Joi.string()
      .pattern(/^[a-zA-Z\s]+$/)
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.empty': 'State is required.',
        'string.pattern.base': 'State can only contain letters and spaces.',
        'string.min': 'State must be at least 2 characters.',
        'string.max': 'State cannot exceed 100 characters.'
      }),
    pinCode: Joi.string()
      .pattern(/^\d{6}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Pin code must be a valid 6-digit number.'
      }),
    mapLink: Joi.string()
      .uri()
      .optional()
      .allow('')
      .messages({
        'string.uri': 'Map link must be a valid URL.'
      })
  })
    .required()
    .messages({
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

  pricing: Joi.object({
    fullDay: Joi.number().min(0).optional().messages({
      'number.min': 'Full day price must be zero or greater.'
    }),
    daySlot: Joi.number().min(0).optional().messages({
      'number.min': 'Day slot price must be zero or greater.'
    }),
    nightSlot: Joi.number().min(0).optional().messages({
      'number.min': 'Night slot price must be zero or greater.'
    })
  })
    .required()
    .messages({
      'object.base': 'Pricing must be a valid object.',
      'any.required': 'Pricing is required.'
    }),

  currency: Joi.string()
    .valid('INR', 'USD', 'EUR')
    .default('INR')
    .messages({
      'any.only': 'Currency must be INR, USD, or EUR.'
    }),

  amenities: Joi.array()
    .items(
      Joi.string()
        .min(2)
        .max(50)
        .messages({
          'string.min': 'Each amenity must be at least 2 characters.',
          'string.max': 'Each amenity cannot exceed 50 characters.'
        })
    )
    .optional(),

  capacity: Joi.number()
    .min(1)
    .required()
    .messages({
      'number.base': 'Capacity must be a number.',
      'number.min': 'Capacity must be at least 1.',
      'any.required': 'Capacity is required.'
    })
});




exports. farmBookingValidationSchema = Joi.object({
  customerName: Joi.string()
    .pattern(/^[a-zA-Z\s]+$/)
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.pattern.base': 'Customer name should only contain letters and spaces.',
      'string.empty': 'Customer name is required.',
      'string.min': 'Customer name must be at least 3 characters.',
      'string.max': 'Customer name must be at most 100 characters.'
    }),

  customerPhone: Joi.string()
    .pattern(/^[6-9][0-9]{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be a valid 10-digit Indian mobile number starting with 6-9.',
      'string.empty': 'Customer phone number is required.',
    }),

  customerEmail: Joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .allow('')
    .messages({
      'string.email': 'Enter a valid email address.'
    }),

  customer: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Customer ID must be a valid MongoDB ObjectId.'
    }),

  farm: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Farm ID must be a valid MongoDB ObjectId.',
      'string.empty': 'Farm ID is required.'
    }),

  date: Joi.date()
    .required()
    .messages({
      'date.base': 'Date must be a valid date.',
      'any.required': 'Booking date is required.'
    }),

  bookingModes: Joi.array()
    .items(Joi.string().valid('full_day', 'day_slot', 'night_slot'))
    .min(1)
    .required()
    .messages({
      'array.base': 'Booking modes must be an array.',
      'array.min': 'At least one booking mode must be selected.',
      'any.only': 'Booking mode must be one of full_day, day_slot, or night_slot.'
    }),

  status: Joi.string()
    .valid('pending', 'confirmed', 'cancelled', 'complete')
    .optional()
    .messages({
      'any.only': 'Status must be one of pending, confirmed, cancelled, or complete.'
    }),

  paymentStatus: Joi.string()
    .valid('unpaid', 'paid')
    .optional()
    .messages({
      'any.only': 'Payment status must be either unpaid or paid.'
    })
});