// middleware/vendorAuth.js

const jwt = require('jsonwebtoken');

const Admin = require('../models/AdminModel');

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
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 🔒 Check token presence
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🧠 Find admin from DB
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found.' });
    }

    // 🚫 Check if admin is deactivated
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is deactivated.' });
    }

    // ✅ Check if token is older than last login
    if (!decoded.lastLogin || decoded.lastLogin < new Date(admin.lastLogin).getTime()) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or outdated. Please login again.'
      });
    }

    // ✅ Attach to req
    req.user = decoded;
    next();

  } catch (err) {
    console.error('🔐 Auth Middleware Error:', err);
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};


module.exports = {vendorAuth,authenticateAdmin};
