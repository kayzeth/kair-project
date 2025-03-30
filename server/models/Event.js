const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    canvasEventId: String,
    courseId: String,
    type: {
        type: String,
        enum: ['canvas', 'custom'],
        default: 'custom'
    },
    color: String,
    isCompleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Event', eventSchema);
