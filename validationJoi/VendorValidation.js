const Joi = require('joi');

const nameRegex = /^[A-Za-z]+(\s[A-Za-z]+)*$/;
const phoneRegex = /^[0-9]{10}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const onlyLetters = /^[A-Za-z\s]+$/;
const alphaNumericSpacePunctuation = /^[a-zA-Z0-9 .,'"()-]*$/;
const alphaSpace = /^[A-Za-z\s]+$/;
const numericOnly = /^[0-9]+$/;


const vendorRegistrationSchema = Joi.object({
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

  businessName: Joi.string().allow('')
});

const addVenueSchema = Joi.object({
  name: Joi.string()
    .pattern(onlyLetters)
    .required()
    .messages({
      'string.empty': 'Name is required.',
      'string.pattern.base': 'Name should contain letters and spaces only. No numbers or symbols allowed.'
    }),
description: Joi.string()
  .pattern(alphaNumericSpacePunctuation)
  .allow('', '.')
  .messages({
    'string.pattern.base': 'Description may contain letters, numbers, spaces, and basic punctuation (. , \' ").'
  }),

  category: Joi.string()
    .valid(
   'Wedding Hall',
    'Banquet',
    'Party Lawn',
    'Conference Hall',
    'Meeting Room',
    'Exhibition Hall',
    'Auditorium',
    'Rooftop Venue',
    'Garden Venue',
    'Community Center',
    'Resort Venue',
    'Farmhouse',
    'Open Ground',
    'Clubhouse',
    'Corporate Event Space',
    'Marriage Palace',
    'Seminar Hall',
    'Private Villa',
    'Heritage Venue',
    'Beachside Venue',
    'Other'
    )
    .required()
    .messages({
      'any.only': 'Category must be one of the allowed options.',
      'string.empty': 'Category is required.'
    }),

  capacity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'Capacity must be a number only.',
      'number.integer': 'Capacity must be an integer.',
      'number.min': 'Capacity must be at least 1.',
      'any.required': 'Capacity is required.'
    }),

  location: Joi.object({
    address: Joi.string().required().messages({
      'string.empty': 'Address is required.'
    }),
    city: Joi.string().pattern(alphaSpace).required().messages({
      'string.empty': 'City is required.',
      'string.pattern.base': 'City should contain letters and spaces only.'
    }),
    state: Joi.string().pattern(alphaSpace).required().messages({
      'string.empty': 'State is required.',
      'string.pattern.base': 'State should contain letters and spaces only.'
    }),
    pinCode: Joi.string().pattern(numericOnly).allow('').messages({
      'string.pattern.base': 'Pin Code must contain numbers only.'
    })
  }).required().messages({
    'object.base': 'Location must be a valid object with address, city, state, and pinCode.'
  }),

  bookingModes: Joi.array()
    .items(Joi.string().valid('full_day', 'day_slot', 'night_slot'))
    .min(1)
    .required()
    .messages({
      'array.includes': 'Booking modes must be one or more of: full_day, day_slot, night_slot.',
      'array.min': 'At least one booking mode must be selected.'
    }),

  pricing: Joi.object({
    fullDay: Joi.number().min(0).allow(null).messages({
      'number.base': 'Full Day price must be a number.',
      'number.min': 'Full Day price must be zero or more.'
    }),
    daySlot: Joi.number().min(0).allow(null).messages({
      'number.base': 'Day Slot price must be a number.',
      'number.min': 'Day Slot price must be zero or more.'
    }),
    nightSlot: Joi.number().min(0).allow(null).messages({
      'number.base': 'Night Slot price must be a number.',
      'number.min': 'Night Slot price must be zero or more.'
    })
  }).required().messages({
    'object.base': 'Pricing must include at least one price field.'
  }),

  currency: Joi.string()
    .default('INR')
    .messages({
      'string.base': 'Currency must be a string.'
    }),
availableDates: Joi.array()
  .items(Joi.date().iso().messages({
    'date.format': 'Available date must be in ISO date format (YYYY-MM-DD).'
  }))
  .messages({
    'array.base': 'Available Dates must be an array of ISO dates.'
  }),
  amenities: Joi.array()
    .items(Joi.string().pattern(onlyLetters).messages({
      'string.pattern.base': 'Amenities should contain letters and spaces only.'
    }))
    .messages({
      'array.base': 'Amenities must be an array of strings.'
    }),

  
});

const vendorLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required.',
    'string.email': 'Must be a valid email.'
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required.'
  })
});



const farmAddValidationSchema = Joi.object({
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


  farmCategory: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      'string.hex': 'Farm category ID must be a valid ObjectId.',
      'string.length': 'Farm category ID must be 24 characters.',
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
      })
    })
  ).optional().messages({
    'array.base': 'Daily pricing must be an array of date-slot objects.'
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


module.exports = {vendorRegistrationSchema,addVenueSchema,vendorLoginSchema,farmAddValidationSchema};
