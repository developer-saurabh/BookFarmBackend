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
      Joi.object({
        date: Joi.date().required().messages({
          'date.base': `"date" must be a valid date`,
          'any.required': `"date" is required`,
        }),
        slots: Joi.array()
          .items(Joi.string().valid("full_day", "day_slot", "full_night","night_slot",))
          .min(1)
          .required()
          .messages({
            'array.base': `"slots" must be an array`,
            'array.min': `"At least one slot must be specified for blocking"`,
          })
      })
    )
    .min(1)
    .required()
    .label('Dates')
    .messages({
      'array.base': `"Dates" must be an array`,
      'array.min': `"Dates" must contain at least one object`,
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
  .items(Joi.string().valid('full_day', 'day_slot', 'night_slot', 'full_night'))
  .min(1)
  .required()
  .messages({
    'array.base': 'Booking modes must be an array.',
    'array.min': 'At least one booking mode must be selected.',
    'any.only': 'Booking mode must be one of: full_day, day_slot, night_slot, or full_night.'
  })
,
Guest_Count: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .required()
    .messages({
      'number.base': 'Guest count must be a number.',
      'number.integer': 'Guest count must be an integer.',
      'number.min': 'At least 1 guest is required.',
      'number.max': 'Guest count must not exceed 500.',
      'any.required': 'Guest count is required.'
    })
 ,
 Group_Category: Joi.string()
    .pattern(/^[A-Za-z\s]+$/)
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Group category must contain only letters and spaces.',
      'string.empty': 'Group category is required.',
      'string.min': 'Group category must be at least 3 characters.',
      'string.max': 'Group category must be at most 50 characters.'
    }),
  barbequeCharcoal: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'barbequeCharcoal must be true or false.'
    }),

  kitchen: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'kitchen must be true or false.'
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

exports.getFacilitiesSchema = Joi.object({})
  .unknown(false)
  .messages({
    'object.unknown': 'Unexpected query parameter provided.'
  });
exports.getFarmTypeSchema = Joi.object({})
  .unknown(false)
  .messages({
    'object.unknown': 'Unexpected query parameter provided.'
  });

exports. getFarmByIdSchema = Joi.object({
  farmId: Joi.string().hex().length(24).required().messages({
    'string.base': 'Farm ID must be a string.',
    'string.length': 'Farm ID must be a valid 24-character hex string.',
    'string.hex': 'Farm ID must be a valid ObjectId.',
    'any.required': 'Farm ID is required.'
  })
});



exports.getImagesByFarmTypeSchema = Joi.object({
  categoryId: Joi.string().hex().length(24).required().messages({
    'string.base': 'Category ID must be a string.',
    'string.length': 'Category ID must be 24 characters long.',
    'string.hex': 'Category ID must be a valid hex ObjectId.',
    'any.required': 'Category ID is required.'
  })
});

exports.FilterQueeryFarm = Joi.object({
    startDate: Joi.date()
    .iso()
    .allow('', null)
    .empty('')
    .messages({
      'date.base': 'Start date must be a valid ISO date.',
      'date.format': 'Start date must follow ISO format (YYYY-MM-DD).'
    }),

  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .allow('', null)
    .empty('')
    .messages({
      'date.base': 'End date must be a valid ISO date.',
      'date.format': 'End date must follow ISO format (YYYY-MM-DD).',
      'date.min': 'End date must be the same or after start date.'
    }),

  // 🔸 Optional: Category filter
  farmCategory: Joi.array()
    .items(
      Joi.string()
        .hex()
        .length(24)
        .messages({
          'string.base': 'Each farm category ID must be a string.',
          'string.hex': 'Each farm category ID must be a valid MongoDB ObjectId.',
          'string.length': 'Each farm category ID must be 24 characters long.'
        })
    )
    .messages({
      'array.base': 'Farm category must be an array of valid IDs.'
    })
    .optional(),
types: Joi.array()
  .items(
    Joi.string()
      .hex()
      .length(24)
      .messages({
        'string.base': 'Each type ID must be a string.',
        'string.hex': 'Each type ID must be a valid MongoDB ObjectId.',
        'string.length': 'Each type ID must be 24 characters long.'
      })
  )
  .messages({
    'array.base': 'Types must be an array of valid ObjectIds.'
  })
  .optional(),
  // 🔸 Optional: Capacity filter
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
        'number.min': 'Maximum must be greater than or equal to minimum.',
        'any.required': 'Maximum capacity is required.'
      })
  })
    .messages({
      'object.base': 'Capacity range must be a valid object.'
    })
    .optional(),

  // 🔸 Optional: Price filter
  priceRange: Joi.object({
    min: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.base': 'Minimum price must be a number.',
        'number.min': 'Minimum price must be at least ₹0.',
        'any.required': 'Minimum price is required.'
      }),

    max: Joi.number()
      .min(Joi.ref('min'))
      .required()
      .messages({
        'number.base': 'Maximum price must be a number.',
        'number.min': 'Maximum price must be greater than or equal to minimum.',
        'any.required': 'Maximum price is required.'
      })
  })
    .messages({
      'object.base': 'Price range must be a valid object.'
    })
    .optional(),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number.',
    'number.min': 'Page must be at least 1.'
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number.',
    'number.min': 'Limit must be at least 1.',
    'number.max': 'Limit cannot be more than 100.'
  }),
  // 🔸 Optional: Facilities filter
  facilities: Joi.array()
    .items(
      Joi.string()
        .hex()
        .length(24)
        .messages({
          'string.base': 'Each facility ID must be a string.',
          'string.hex': 'Each facility ID must be a valid MongoDB ObjectId.',
          'string.length': 'Each facility ID must be 24 characters long.'
        })
    )
    .messages({
      'array.base': 'Facilities must be an array of valid ObjectIds.'
    })
    .optional()

}).options({
  abortEarly: false,   // Show all errors instead of stopping at the first one
  allowUnknown: true   // Allow extra keys in the request body for future compatibility
});

exports.getFarmByImageSchema = Joi.object({
  farmId: Joi.string()
    .required()
    .messages({
      'string.base': 'Farm ID must be a string.',
      'string.empty': 'Farm ID is required.',
      'any.required': 'Farm ID is required.'
    }),
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
      Joi.object({
        date: Joi.date().required().messages({
          'date.base': `"date" must be a valid date`,
          'any.required': `"date" is required`,
        }), 
        slots: Joi.array()
          .items(Joi.string().valid("full_day", "day_slot", "night_slot","full_night"))
          .min(1)
          .required()
          .messages({
            'array.base': `"slots" must be an array`,
            'array.min': `"At least one slot must be specified for unblocking"`,
          })
      })
    )
    .min(1)
    .required()
    .label('Dates')
    .messages({
      'array.base': `"Dates" must be an array`,
      'array.min': `"Dates" must contain at least one object`,
      'any.required': `"Dates" field is required`,
    }),
}).options({
  abortEarly: false,
  allowUnknown: false,
});
