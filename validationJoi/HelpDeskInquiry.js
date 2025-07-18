const Joi = require('joi');

exports.helpDeskValidation = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.base': 'Name must be a string.',
      'string.empty': 'Name is required.',
      'string.min': 'Name must be at least 2 characters long.',
      'string.max': 'Name must not exceed 100 characters.',
      'any.required': 'Name is required.'
    }),

  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      'string.base': 'Email must be a string.',
      'string.email': 'Email must be a valid email address.',
      'string.empty': 'Email is required.',
      'any.required': 'Email is required.'
    }),

  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Phone number must be 10 to 15 digits only.',
      'string.base': 'Phone number must be a string.'
    }),

  subject: Joi.string()
    .trim()
    .min(3)
    .max(200)
    .required()
    .messages({
      'string.base': 'Subject must be a string.',
      'string.empty': 'Subject is required.',
      'string.min': 'Subject must be at least 3 characters long.',
      'string.max': 'Subject must not exceed 200 characters.',
      'any.required': 'Subject is required.'
    }),

  message: Joi.string()
    .trim()
    .min(5)
    .max(1000)
    .required()
    .messages({
      'string.base': 'Message must be a string.',
      'string.empty': 'Message is required.',
      'string.min': 'Message must be at least 5 characters long.',
      'string.max': 'Message must not exceed 1000 characters.',
      'any.required': 'Message is required.'
    })

}).options({
  abortEarly: false,      // Return all validation errors
  allowUnknown: false     // Disallow unknown fields (can set to true if needed)
});