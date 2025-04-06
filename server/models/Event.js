const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false // Changed to false to make it optional
  },
  title: {
    type: String,
    required: true
  },
  all_day: {
    type: Boolean,
    default: false
  },
  start_time: {
    type: Date,
    required: true
  },
  end_time: {
    type: Date,
    required: true
  },
  source: {
    type: String,
    enum: ['LMS', 'GOOGLE_CALENDAR', 'SYLLABUS'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  requires_preparation: {
    type: Boolean,
    default: false
  },
  requires_hours: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#d2b48c'
  },
  google_event_id: {
    type: String,
    default: null
  },
  // Add fields for study sessions
  is_study_session: {
    type: Boolean,
    default: false
  },
  related_event_id: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient querying of user's events
eventSchema.index({ user_id: 1, start_time: 1 });
// Index for group events
eventSchema.index({ group_id: 1, start_time: 1 });
// Index for finding study sessions related to a specific event
eventSchema.index({ related_event_id: 1 });
// Index for finding all study sessions
eventSchema.index({ is_study_session: 1 });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
