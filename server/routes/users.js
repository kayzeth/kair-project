const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      name,
      email,
      password_hash: password // Will be hashed by pre-save middleware
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Google Calendar sync token for a user
router.put('/:userId/google-sync-token', async (req, res) => {
  try {
    const { userId } = req.params;
    const { syncToken } = req.body;
    
    console.log(`Updating Google Calendar sync token for user ${userId}`);
    
    if (syncToken === undefined) {
      console.log('Sync token is undefined');
      return res.status(400).json({ message: 'Sync token is required' });
    }
    
    // Find and update the user
    const user = await User.findByIdAndUpdate(
      userId,
      { google_calendar_sync_token: syncToken },
      { new: true } // Return the updated document
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'Google Calendar sync token updated successfully',
      syncToken: user.google_calendar_sync_token
    });
  } catch (error) {
    console.error('Error updating Google Calendar sync token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Google Calendar sync token for a user
router.get('/:userId/google-sync-token', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find the user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      syncToken: user.google_calendar_sync_token || null
    });
  } catch (error) {
    console.error('Error getting Google Calendar sync token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
