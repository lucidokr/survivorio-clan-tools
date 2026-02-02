const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  playerName: {
    type: String,
    required: true
  },
  playerId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String
  },
  discordNickname: {
    type: String
  },
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    required: true
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Member', memberSchema);
