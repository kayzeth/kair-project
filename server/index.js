const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-canvas-domain']
}));
app.use(express.json());

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

    // Log the full URL and response for debugging
    console.log('Canvas API request details:', {
      fullUrl: canvasUrl,
      method: req.method,
      responseStatus: response.status,
      responseStatusText: response.statusText
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
    console.log('Canvas API success:', {
      dataLength: Array.isArray(data) ? data.length : 'Not an array',
      data: Array.isArray(data) ? data.slice(0, 2) : data // Log first 2 items if array
    });
    res.json(data);
  } catch (error) {
    console.error('Canvas API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
