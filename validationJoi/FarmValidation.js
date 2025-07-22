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

  // 🔁 Replaces farmType
  farmCategory: Joi.array()
    .items(Joi.string().hex().length(24).messages({
      'string.hex': 'Each farm category ID must be a valid ObjectId.',
      'string.length': 'Each farm category ID must be 24 characters.'
    }))
    .min(1)
    .required()
    .messages({
      'array.base': 'Farm category must be an array of valid IDs.',
      'array.min': 'At least one farm category is required.',
      'any.required': 'Farm category is required.'
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
    full_day: Joi.number().min(0).optional().messages({
      'number.min': 'Full day price must be zero or greater.'
    }),
    day_slot: Joi.number().min(0).optional().messages({
      'number.min': 'Day slot price must be zero or greater.'
    }),
    night_slot: Joi.number().min(0).optional().messages({
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

  // ✅ Replaces amenities
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
});


const objectIdPattern = /^[0-9a-fA-F]{24}$/;

exports.blockDateSchema = Joi.object({
  farmId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .label('Farm ID')
    .messages({
      'string.pattern.base': `"Farm ID" must be a valid MongoDB ObjectId`,
    }),

  dates: Joi.array()
    .items(
      Joi.date().required().messages({
        'date.base': `"Each date" must be a valid date`,
        'any.required': `"Each date" is required`,
      })
    )
    .min(1)
    .required()
    .label('Dates')
    .messages({
      'array.base': `"Dates" must be an array`,
      'array.min': `"Dates" must contain at least one date`,
      'any.required': `"Dates" field is required`,
    }),
}).options({
  abortEarly: false,
  allowUnknown: false,
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

  // customer: Joi.string()
  //   .pattern(/^[0-9a-fA-F]{24}$/)
  //   .optional()
  //   .messages({
  //     'string.pattern.base': 'Customer ID must be a valid MongoDB ObjectId.'
  //   }),

  farm_id: Joi.string()
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

 
});



exports.FilterQueeryHomePageScheam = Joi.object({
  date: Joi.date().iso().required().messages({
    'any.required': 'Date is required',
    'date.base': 'Date must be in valid ISO format'
  }),
  category: Joi.string().required().messages({
    'any.required': 'Category is required'
  }),
   capacityRange: Joi.object({
    min: Joi.number().required(),
    max: Joi.number().required()
  }).required()
});

exports. getCategoriesSchema = Joi.object({})
  .unknown(false)
  .messages({
    'object.unknown': 'Unexpected query parameter provided.'
  });


<<<<<<< HEAD

exports. getFarmByIdSchema = Joi.object({
=======
exports.getFarmByIdSchema = Joi.object({
>>>>>>> b3a518feb253ef02d9ef36097bbc7c1fbb31fe88
  farmId: Joi.string().hex().length(24).required().messages({
    'string.base': 'Farm ID must be a string.',
    'string.length': 'Farm ID must be a valid 24-character hex string.',
    'string.hex': 'Farm ID must be a valid ObjectId.',
    'any.required': 'Farm ID is required.'
  })
});



<<<<<<< HEAD
=======

>>>>>>> b3a518feb253ef02d9ef36097bbc7c1fbb31fe88
exports.getImagesByFarmTypeSchema = Joi.object({
  categoryId: Joi.string().hex().length(24).required().messages({
    'string.base': 'Category ID must be a string.',
    'string.length': 'Category ID must be 24 characters long.',
    'string.hex': 'Category ID must be a valid hex ObjectId.',
    'any.required': 'Category ID is required.'
  })
});



exports.FilterQueeryFarm = Joi.object({
  date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'Date must be a valid date.',
      'date.format': 'Date must be in valid ISO format (YYYY-MM-DD).',
      'any.required': 'Date is required.'
    }),

  farmCategory: Joi.array()
    .items(
      Joi.string()
        .hex()
        .length(24)
        .messages({
          'string.base': 'Each farm category ID must be a string.',
          'string.hex': 'Each farm category ID must be a valid ObjectId.',
          'string.length': 'Each farm category ID must be 24 characters long.'
        })
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Farm category must be an array of ObjectIds.',
      'array.min': 'At least one farm category must be provided.',
      'any.required': 'Farm category is required.'
    }),

  capacityRange: Joi.object({
    min: Joi.number()
      .integer()
      .min(1)
      .required()
      .messages({
        'number.base': 'Minimum capacity must be a number.',
        'number.min': 'Minimum capacity must be at least 1.',
        'any.required': 'Minimum capacity is required.'
      }),

    max: Joi.number()
      .integer()
      .min(Joi.ref('min'))
      .required()
      .messages({
        'number.base': 'Maximum capacity must be a number.',
        'number.min': 'Maximum capacity must be equal to or greater than minimum.',
        'any.required': 'Maximum capacity is required.'
      })
  }).required().messages({
    'object.base': 'Capacity range must be a valid object.',
    'any.required': 'Capacity range is required.'
  }),

  priceRange: Joi.object({
    min: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.base': 'Minimum price must be a number.',
        'number.min': 'Minimum price must be at least 0.',
        'any.required': 'Minimum price is required.'
      }),

    max: Joi.number()
      .min(Joi.ref('min'))
      .required()
      .messages({
        'number.base': 'Maximum price must be a number.',
        'number.min': 'Maximum price must be equal to or greater than minimum.',
        'any.required': 'Maximum price is required.'
      })
  }).required().messages({
    'object.base': 'Price range must be a valid object.',
    'any.required': 'Price range is required.'
  }),

  facilities: Joi.array()
    .items(
      Joi.string()
        .hex()
        .length(24)
        .messages({
          'string.base': 'Each facility ID must be a string.',
          'string.hex': 'Each facility ID must be a valid ObjectId.',
          'string.length': 'Each facility ID must be 24 characters long.'
        })
    )
    .optional()
    .messages({
      'array.base': 'Facilities must be an array of valid ObjectIds.'
    })

}).options({
  abortEarly: false,     // ✅ Return all errors at once
  allowUnknown: true     // ✅ Ignore unknown keys in the request body
});

exports.getFarmByImageSchema = Joi.object({
  imageurl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required()
    .messages({
      'string.base': 'Image URL must be a string.',
      'string.empty': 'Image URL is required.',
      'string.uri': 'Image URL must be a valid HTTP or HTTPS URI.',
      'any.required': 'Image URL is required.'
    })
});



exports.unblockDateSchema = Joi.object({
  farmId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .label('Farm ID')
    .messages({
      'string.pattern.base': `"Farm ID" must be a valid MongoDB ObjectId`,
      'any.required': `"Farm ID" is required`,
      'string.empty': `"Farm ID" cannot be empty`,
    }),

  dates: Joi.array()
    .items(
      Joi.date().required().messages({
        'date.base': `"Each date" must be a valid date`,
        'any.required': `"Each date" is required`,
      })
    )
    .min(1)
    .required()
    .label('Dates')
    .messages({
      'array.base': `"Dates" must be an array`,
      'array.min': `"Dates" must contain at least one date`,
      'any.required': `"Dates" field is required`,
    }),
}).options({
  abortEarly: false,
  allowUnknown: false,
});