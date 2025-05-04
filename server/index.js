// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const fetch = require('node-fetch');

// Set NODE_ENV to 'development' if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

console.log('Server starting in', process.env.NODE_ENV, 'mode');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002', // Adding another possible dev port
    'https://kairos-public-project.vercel.app',
    'https://*.vercel.app' // Support all Vercel preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-canvas-domain']
}));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json({ limit: '16mb' }));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/events', require('./routes/events'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/lmsintegration', require('./routes/lmsintegration'));
app.use('/api/gemini', require('./routes/gemini'));

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

    // Domain can be either canvas.*.edu or *.instructure.com format
    if (!domain.includes('instructure.com') && !domain.includes('canvas.')) {
      return res.status(400).json({ error: 'Invalid domain format. Must be either canvas.*.edu or *.instructure.com' });
    }

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
    const maxContentLength = 200000; // Adjust based on token limits
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '... (content truncated)' 
      : content;
    
    // Prepare request bodys
    const requestBody = {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `
      You are an assistant that extracts **structured JSON** from real-world course syllabi, even when they are long, messy, or incomplete.
    
      Return *only* a JSON object with this exact shape:
      - Do not wrap the output in backticks or markdown formatting. Output only plain, raw JSON.
      {
        "courseName": "...",
        "courseCode": "...",
        "instructor": "...",
        "meetingTimes": [
          {
            "day":  "..." Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (If multiple days, create mutliple objects)
            "startTime": "HH:MM AM/PM | unknown",
            "endTime":   "HH:MM AM/PM | unknown",
            "location":  "..."
          }
        ],
        "assignments": [
          { "title": "...", "dueDate": "YYYY-MM-DD | unknown", "description": "..." }
        ],
        "exams": [
          { "title": "...", "date": "YYYY-MM-DD | unknown", "time": "...", "location": "...", "description": "..." }
        ]
      }
    
      Guidelines
      - **Canonical weekday codes**:
        - Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
        - If a syllabus groups days (“MW”, “Mon/Wed”, “T-Th”, “Tuesday & Thursday”) **split them into separate meetingTimes objects**, one per code.
      - If any meeting-time field is missing, still emit the object and fill the slot with **"unknown"** (not empty).
      - If a date omits the year, assume **2025** and output "YYYY-MM-DD".
      - Never invent data; never summarize multiple items into one; mark absent items **"unknown"**.
      - Use the word **"error"** **only** when the entire input is clearly *not* a syllabus (empty, blank, or unrelated text).
      - Do not output anything except the JSON object.`
        },
        {
          role: "user",
          content: truncatedContent
        }
      ],
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
