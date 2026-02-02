const mongoose = require('mongoose');

const clanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  clanId: {
    type: String,
    required: true,
    unique: true
  },
  tag: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  screenshot: {
    type: String // Path to the verification screenshot
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Clan', clanSchema);
