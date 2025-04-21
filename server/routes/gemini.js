const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Public route to get Gemini API key - no authentication required
router.get('/api-key-public', async (req, res) => {
  try {
    // Return the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        message: 'Gemini API key not configured on server' 
      });
    }
    
    res.json({ apiKey });
  } catch (error) {
    console.error('Error retrieving Gemini API key:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route to get Gemini API key (requires authentication)
router.get('/api-key', auth, async (req, res) => {
  try {
    // Return the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        message: 'Gemini API key not configured on server' 
      });
    }
    
    res.json({ apiKey });
  } catch (error) {
    console.error('Error retrieving Gemini API key:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
