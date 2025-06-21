const Joi = require('joi');

// Regex: no numbers in name, no extra spaces, must have at least one letter
const nameRegex = /^[A-Za-z]+(\s[A-Za-z]+)*$/;
// Phone: exactly 10 digits
const phoneRegex = /^[0-9]{10}$/;
// Password: min 8 chars, at least one letter, one number, one special
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

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

module.exports = vendorRegistrationSchema;
