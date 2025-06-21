// utils/parseNestedForm.js
const qs = require('qs');

module.exports = (req, res, next) => {
  if (req.method === 'POST' && req.is('multipart/form-data') && req.body) {
    // Converts: { 'location[address]': 'X' } => { location: { address: 'X' } }
    req.body = qs.parse(qs.stringify(req.body));
  }
  next();
};
