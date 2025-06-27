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
