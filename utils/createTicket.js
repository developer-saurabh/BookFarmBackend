const Ticket = require('../models/TicketBookingModel');

module.exports = async function createTicket(bookingDoc, vendorId, type) {
  return Ticket.create({
    booking: bookingDoc._id,
    bookingModel: bookingDoc.constructor.modelName,
    vendor: vendorId,
    type
  });
};
