const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  week: {
    type: String,
    required: true // Format: YYYY-WW (e.g., 2024-05)
  },
  bossLevel: {
    type: Number,
    default: null
  },
  missedBossDay1: {
    type: Boolean,
    default: false
  },
  missedBossDay2: {
    type: Boolean,
    default: false
  },
  missedBossDay3: {
    type: Boolean,
    default: false
  },
  screenshot: {
    type: String // Path to the screenshot
  },
  isManualEntry: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
resultSchema.index({ clan: 1, week: 1, score: -1 });
resultSchema.index({ member: 1, week: 1 });

module.exports = mongoose.model('Result', resultSchema);
