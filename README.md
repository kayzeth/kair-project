# Kairos Project
The one-stop-shop for students

## Features
- Calendar management for students
- Syllabus parsing with AI to automatically extract important dates and events
- Canvas integration for course management

## Deployment Guide

### Setting up OpenAI API for Syllabus Parser

The syllabus parser feature uses OpenAI's API to extract important dates and events from course syllabi. To securely deploy this feature, you need to set up an environment variable in Vercel without exposing your API key in the codebase.

#### Steps to Configure OpenAI API Key in Vercel

1. **Get an OpenAI API Key**
   - Sign up or log in to [OpenAI](https://platform.openai.com/)
   - Navigate to the API section and create a new API key
   - Copy the API key (you'll only see it once)

2. **Add Environment Variable in Vercel**
   - Log in to your [Vercel dashboard](https://vercel.com/)
   - Select your Kairos project
   - Go to "Settings" > "Environment Variables"
   - Add a new environment variable:
     - Name: `OPENAI_API_KEY`
     - Value: Your OpenAI API key
     - Select all environments (Production, Preview, Development)
   - Click "Save"

3. **Redeploy Your Application**
   - After setting the environment variable, redeploy your application for the changes to take effect
   - You can trigger a redeployment by pushing a new commit or using the "Redeploy" option in the Vercel dashboard

### Local Development

For local development, create a `.env` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
```

Make sure to add `.env` to your `.gitignore` file to prevent accidentally committing your API key.

## Security Considerations

- The OpenAI API key is stored securely in Vercel's environment variables and is never exposed to the client
- All API calls to OpenAI are made through a secure backend route
- User data is processed on the server side, ensuring that sensitive information is not exposed

## Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm start
```

The application will be available at http://localhost:3000
