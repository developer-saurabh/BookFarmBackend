const Joi = require('joi');

// Password: min 8 chars, at least 1 letter, 1 number, 1 special char
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const phoneRegex = /^[0-9]{10}$/;


const adminRegisterSchema = Joi.object({
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
const updateVendorStatusSchema = Joi.object({
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

module.exports = {adminRegisterSchema,updateVendorStatusSchema};
