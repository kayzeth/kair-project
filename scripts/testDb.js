require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../server/models/User');
const Group = require('../server/models/Group');
const Event = require('../server/models/Event');
const LmsIntegration = require('../server/models/LmsIntegration');

async function testDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a test user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password_hash: 'dummypasswordhash123'
    });
    console.log('Created test user:', user);

    // Create a test group
    const group = await Group.create({
      name: 'CS50 Study Group',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR'
    });
    console.log('Created test group:', group);

    // Create a test LMS integration
    const lmsIntegration = await LmsIntegration.create({
      user_id: user._id,
      lms_type: 'CANVAS',
      token: 'test_token_123',
      domain: 'harvard',
      last_synced: new Date()
    });
    console.log('Created test LMS integration:', lmsIntegration);

    // Create a test event
    const event = await Event.create({
      user_id: user._id,
      group_id: group._id,
      title: 'CS50 Lecture',
      all_day: false,
      start_time: new Date('2025-04-04T14:00:00'),
      end_time: new Date('2025-04-04T15:30:00'),
      source: 'LMS',
      description: 'Introduction to Computer Science lecture',
      location: 'Sanders Theatre',
      requires_preparation: true,
      requires_hours: 2
    });
    console.log('Created test event:', event);

    // Query and display all collections
    console.log('\nQuerying all collections:');
    console.log('\nUsers:', await User.find());
    console.log('\nGroups:', await Group.find());
    console.log('\nLMS Integrations:', await LmsIntegration.find());
    console.log('\nEvents:', await Event.find());

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

testDatabase();
