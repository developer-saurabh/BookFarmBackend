const Joi = require('joi');

exports. addFarmCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Category name is required',
      'string.min': 'Category name must be at least 2 characters',
      'string.max': 'Category name must not exceed 100 characters'
    })
});
exports.addFacilitiesSchema = Joi.object({
  facilities: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().min(2).max(100).required().messages({
        'string.empty': 'Facility name is required',
        'string.min': 'Facility name must be at least 2 characters',
        'string.max': 'Facility name must not exceed 100 characters'
      }),
      original_name: Joi.string().trim().min(2).max(100).required().messages({
        'string.empty': 'Original name is required',
        'string.min': 'Original name must be at least 2 characters',
        'string.max': 'Original name must not exceed 100 characters'
      }),
      icon: Joi.string().uri().optional().allow(null, '') // optional URL
    })
  ).min(1).required().messages({
    'array.min': 'At least one facility must be provided',
    'any.required': 'Facilities array is required'
  })
});
