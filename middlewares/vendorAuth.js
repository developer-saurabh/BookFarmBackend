// middleware/vendorAuth.js

const jwt = require('jsonwebtoken');

const vendorAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please login first.' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'vendor') {
      return res.status(403).json({ error: 'Unauthorized: Token does not belong to a vendor.' });
    }

    // Attach user info to request for downstream use
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();

  } catch (err) {
    console.error('🚨 Vendor Auth Error:', err);
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
};

module.exports = {vendorAuth};
