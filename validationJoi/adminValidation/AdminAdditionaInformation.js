const Joi = require("joi");

const farmhouseBookingValidationSchema = Joi.object({
  farmhouseName: Joi.string().allow("").optional(),
  bookingId: Joi.number().allow(null).optional(),

  address: Joi.string().allow("").optional(),
  dateOfRegistration: Joi.date().allow(null).optional(),

  guestName: Joi.string().allow("").optional(),
  mobileNumber: Joi.string().allow("").optional(),
  alternateMobileNumber: Joi.string().allow("").optional(),

  numberOfGuests: Joi.number().allow(null).optional(),

  bookingStatus: Joi.string()
    .valid("pending", "confirmed", "cancelled", "completed")
    .allow("")
    .optional(),

  bookingDate: Joi.date().allow(null).optional(),

  slots: Joi.array()
    .items(Joi.string().valid("full_day", "day_slot", "night_slot", "full_night"))
    .optional(),

  // 👇 now validate as AM/PM string
  checkIn: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
    .allow("")
    .optional(),

  checkOut: Joi.string()
    .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
    .allow("")
    .optional(),

  totalAmount: Joi.number().allow(null).optional(),
  discount: Joi.number().allow(null).optional(),
  advancePaid: Joi.number().allow(null).optional(),
  balanceDue: Joi.number().allow(null).optional(),
  securityDeposit: Joi.number().allow(null).optional(),

  email: Joi.string().email().allow("").optional(),
});

module.exports = { farmhouseBookingValidationSchema };
