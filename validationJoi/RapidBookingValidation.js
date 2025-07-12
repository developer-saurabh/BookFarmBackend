const Joi = require('joi');
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

exports.rapidBookingSchema = Joi.object({
  customerName: Joi.string().min(2).max(100).required().messages({
    'string.base': 'Customer name must be a string',
    'string.empty': 'Customer name is required',
    'any.required': 'Customer name is required'
  }),

  customerPhone: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
    'string.pattern.base': 'Customer phone must be a 10-digit number',
    'any.required': 'Customer phone is required'
  }),

  customerEmail: Joi.string().email().optional().allow(null, '').messages({
    'string.email': 'Customer email must be a valid email'
  }),

  farm: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base': 'Farm must be a valid MongoDB ObjectId',
    'any.required': 'Farm ID is required'
  }),

  requestedDate: Joi.date().iso().required().messages({
    'date.base': 'Requested date must be a valid ISO date',
    'any.required': 'Requested date is required'
  }),

  bookingModes: Joi.array().items(
    Joi.string().valid('full_day', 'day_slot', 'night_slot')
  ).min(1).required().messages({
    'array.base': 'Booking modes must be an array of strings',
    'any.required': 'At least one booking mode is required'
  }),

  notes: Joi.string().max(500).optional().allow('').messages({
    'string.base': 'Notes must be a string',
    'string.max': 'Notes can be at most 500 characters'
  })
}).options({
  abortEarly: false,
  allowUnknown: false
});