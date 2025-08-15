// validation/TypeValidation.js
const Joi = require('joi');
const mongoose = require('mongoose');

const isObjectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const baseName = Joi.string().trim().min(2).max(60);

// Create
const createSchema = Joi.object({
  name: baseName.required(),
  isActive: Joi.boolean().optional()
});

// Update
const updateSchema = Joi.object({
  typeId: Joi.string().custom(isObjectId, 'ObjectId validation').required(),
  name: baseName.optional(),
  isActive: Joi.boolean().optional()
}).or('name', 'isActive'); // at least one to update

// Get by ID
const getByIdSchema = Joi.object({
  typeId: Joi.string().custom(isObjectId, 'ObjectId validation').required()
});

// Toggle status
const toggleSchema = Joi.object({
  typeId: Joi.string().custom(isObjectId, 'ObjectId validation').required(),
  isActive: Joi.boolean().required()
});

// Delete
const deleteSchema = Joi.object({
  typeId: Joi.string().custom(isObjectId, 'ObjectId validation').required()
});

// List / query
const listSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow('', null),
  isActive: Joi.boolean().optional(),
  sortBy: Joi.string().valid('name', 'isActive', 'createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ascending', 'descending', '1', '-1').default('desc')
});

module.exports = {
  TypeValidation: {
    createSchema,
    updateSchema,
    getByIdSchema,
    toggleSchema,
    deleteSchema,
    listSchema
  }
};
