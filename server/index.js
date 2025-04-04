// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const fetch = require('node-fetch');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-canvas-domain']
}));
app.use(express.json({ limit: '16mb' }));

// Routes
app.use('/api/users', require('./routes/users'));

// Proxy all Canvas API requests
app.use('/api/canvas/*', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const domain = req.headers['x-canvas-domain'];
    
    console.log('Received request:', {
      path: req.params[0],
      domain,
      hasToken: !!token
    });

    if (!token || !domain) {
      console.error('Missing credentials:', { token: !!token, domain });
      return res.status(400).json({ error: 'Missing token or domain' });
    }

    // Domain should already be in the format canvas.domain.edu from the frontend
    const canvasUrl = `https://${domain}/api/v1/${req.params[0]}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    console.log('Making request to Canvas API:', {
      url: canvasUrl,
      method: req.method,
      headers: {
        'Authorization': token ? '[REDACTED]' : 'None',
        'Content-Type': 'application/json'
      }
    });
    
    const response = await fetch(canvasUrl, {
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Canvas API error response:', error);
      
      // Return the actual error status code instead of always returning 500
      res.status(response.status).json({ 
        error: error || 'Failed to make Canvas API request',
        details: {
          status: response.status,
          statusText: response.statusText,
          url: canvasUrl
        }
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Canvas API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}); 

// OpenAI API route
app.post('/api/openai/syllabus-parser', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Missing syllabus content' });
    }
    
    // Get API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API key is missing from environment variables');
      return res.status(500).json({ error: 'Server configuration error: API key is missing' });
    }
    
    // Truncate content if it's too long
    const maxContentLength = 15000; // Adjust based on token limits
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '... (content truncated)' 
      : content;
    
    // Prepare request body
    const requestBody = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that parses course syllabi. Extract all relevant information including course name, course code, instructor, meeting times, and assignment due dates. Format the output as a valid JSON object with the following structure: { courseName, courseCode, instructor, meetingTimes: [{day, startTime, endTime, location}], assignments: [{title, dueDate, description}], exams: [{title, date, time, location, description}] }\n\nIMPORTANT: If the provided text does not appear to be a valid course syllabus, or if you cannot confidently extract the required information, DO NOT make up fake data. Instead, return a JSON object with an 'error' field like this: { \"error\": \"This does not appear to be a valid course syllabus\" }. Never return made-up course information."
        },
        {
          role: "user",
          content: `Parse the following syllabus and extract all relevant information. Format your response as a valid JSON object. If this is not a valid syllabus, return an error message as instructed.\n\n${truncatedContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    };
    
    console.log('Sending request to OpenAI API...');
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // Try to get error details
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        console.error('OpenAI API error details:', JSON.stringify(errorData, null, 2));
        errorMessage = `OpenAI API error: ${errorData.error?.message || errorData.message || 'Unknown error'}`;
      } catch (jsonError) {
        console.error('Failed to parse error response:', jsonError);
        const errorText = await response.text();
        console.error('Error response text:', errorText);
      }
      return res.status(500).json({ error: errorMessage });
    }
    
    const data = await response.json();
    console.log('OpenAI API Response received');
    
    res.json(data);
  } catch (error) {
    console.error('Error processing syllabus:', error);
    res.status(500).json({ error: 'Failed to process syllabus: ' + error.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
