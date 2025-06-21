const Joi = require('joi');

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

module.exports = updateVendorStatusSchema;
