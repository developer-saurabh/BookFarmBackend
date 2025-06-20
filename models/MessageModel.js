const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Link to ChatSession
  phone: {
    type: String,
    required: true
  },

  sessionId: {
    type: String // optional if you generate a UUID per session
  },

  // Who sent it: customer or bot
  sender: {
    type: String,
    enum: ['customer', 'bot'],
    required: true
  },

  // Actual text
  message: {
    type: String,
    required: true
  },

  // Optional attachments: images, docs, audio, etc.
  attachments: [{
    type: String
  }],

  // Extra metadata (like NLP confidence, detected intent, etc.)
  metaData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
