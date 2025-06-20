const Joi = require('joi');

const onlyLetters = /^[A-Za-z\s]+$/;
const alphaNumericSpace = /^[A-Za-z0-9\s]+$/;
const alphaSpace = /^[A-Za-z\s]+$/;
const numericOnly = /^[0-9]+$/;

const addVenueSchema = Joi.object({
  name: Joi.string()
    .pattern(onlyLetters)
    .required()
    .messages({
      'string.empty': 'Name is required.',
      'string.pattern.base': 'Name should contain letters and spaces only. No numbers or symbols allowed.'
    }),

  description: Joi.string()
    .pattern(alphaNumericSpace)
    .allow('')
    .messages({
      'string.pattern.base': 'Description should not contain special characters except letters, numbers and spaces.'
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

  amenities: Joi.array()
    .items(Joi.string().pattern(onlyLetters).messages({
      'string.pattern.base': 'Amenities should contain letters and spaces only.'
    }))
    .messages({
      'array.base': 'Amenities must be an array of strings.'
    }),

  owner: Joi.string()
    .required()
    .messages({
      'string.empty': 'Owner ID is required.'
    })
});

module.exports = addVenueSchema;
