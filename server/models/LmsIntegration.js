const mongoose = require('mongoose');

const lmsIntegrationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lms_type: {
    type: String,
    enum: ['CANVAS'],
    required: true
  },
  token: {
    type: String,
    required: true
  },
  domain: {
    type: String,
    required: true
  },
  last_synced: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster lookups by user_id
lmsIntegrationSchema.index({ user_id: 1 });

const LmsIntegration = mongoose.model('LmsIntegration', lmsIntegrationSchema);
module.exports = LmsIntegration;
