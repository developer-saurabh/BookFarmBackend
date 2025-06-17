const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  profilePic: { type: String }, // optional, if you fetch via WhatsApp API
  currentState: {
    type: String,
    enum: [
      'new',
      'greeted',
      'awaiting_option',
      'booking',
      'checking_availability',
      'cancelling',
      'done'
    ],
    default: 'new'
  },
  metaData: {
    // Extra data to carry temp info in a conversation, like selected venue ID before confirmation
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastInteraction: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
