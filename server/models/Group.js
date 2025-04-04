const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  recurrence_rule: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster name lookups
groupSchema.index({ name: 1 });

const Group = mongoose.model('Group', groupSchema);
module.exports = Group;
