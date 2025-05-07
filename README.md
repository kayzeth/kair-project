# Kairos Project

The comprehensive academic management platform for students.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
  - [Unit Tests](#unit-tests)
  - [Server Tests](#server-tests)
  - [End-to-End Tests](#end-to-end-tests)
  - [Test Coverage](#test-coverage)
- [Deployment](#deployment)
  - [Setting up API Keys](#setting-up-api-keys-for-deployment)
  - [Vercel Deployment](#vercel-deployment)
- [Canvas LMS Integration](#canvas-lms-integration)
- [Security Considerations](#security-considerations)
- [Browser Compatibility](#browser-compatibility)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Overview

Kairos is a comprehensive academic management platform designed to help students organize their academic lives efficiently. It combines calendar management, syllabus parsing using AI, and Canvas LMS integration to provide a centralized hub for all student needs.

## Features

- **Calendar Management**
  - Interactive calendar interface for managing academic events
  - Create, edit, and delete events with customizable reminders
  - Color-coded event categories for easy visual organization
  - Group study session planning and coordination

- **AI-Powered Syllabus Parsing**
  - Automatic extraction of important dates, assignments, and exams from course syllabi
  - Uses OpenAI's GPT-4o model for accurate information extraction
  - Supports PDF and text-based syllabus formats
  - One-click addition of extracted events to calendar

- **Canvas LMS Integration**
  - Seamless connection to Canvas Learning Management System
  - Automatic import of courses, assignments, and due dates
  - Real-time synchronization with Canvas calendar
  - Access to course materials directly through Kairos

- **Smart Study Suggestions**
  - AI-powered study session planning based on event type and preparation needs
  - Intelligent distribution of study hours across available days
  - Customized session lengths and priorities based on proximity to deadlines
  - Automatic scheduling around existing calendar events

## Architecture

Kairos is built using the following technology stack:

- **Frontend**: React.js with React Router for navigation
- **Backend**: Node.js with Express
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Google OAuth integration
- **API Integration**: Canvas API, OpenAI API
- **Testing**: Jest, React Testing Library, Cypress
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- MongoDB (local or Atlas connection)
- OpenAI API key (for syllabus parsing)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/kairos-public-project.git
   cd kairos-public-project
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Deployment Configuration
CI=false
```

> **Note**: The `CI=false` setting is important for Vercel deployments to prevent build failures due to warnings.

## Running the Application

The application consists of both a React frontend and a Node.js backend. You can run both simultaneously using:

```bash
npm start
```

This will start:
- The React frontend on http://localhost:3000
- The Express backend on http://localhost:3001

To run only the backend server:

```bash
npm run server
```

To run only the frontend in development mode:

```bash
react-app-rewired start
```

## Testing

Kairos has a comprehensive testing suite including unit tests, server tests, and end-to-end tests.

### Unit Tests

Unit tests are written using Jest and React Testing Library. To run all frontend unit tests:

```bash
npm test
```

To run tests in watch mode (useful during development):

```bash
npm test -- --watch
```

### Server Tests

Server tests verify the backend API functionality. To run server tests:

```bash
npm run test:server
```

### End-to-End Tests

End-to-end tests use Cypress to test the application in a real browser environment. To open the Cypress test runner:

```bash
npm run cypress:open
```

To run Cypress tests headlessly:

```bash
npm run cypress:run
```

### Test Coverage

To generate test coverage reports:

```bash
# Frontend test coverage
npm run test:coverage

# Server test coverage
npm run test:server:coverage

# Combined coverage report
npm run test:all:coverage
```

Coverage reports will be generated in the `coverage` directory.

> **Note**: When running tests that involve react-router-dom, be aware that the project uses a custom mock for react-router-dom in `src/__mocks__/react-router-dom.js`. For components that directly import from react-router-dom, you may need to add a local mock in each test file before importing the component.

## Deployment

### Setting up API Keys for Deployment

Kairos requires API keys for its AI-powered features:

#### OpenAI API Key
The syllabus parser feature uses OpenAI's API to extract important dates and events from course syllabi. To securely deploy this feature:

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

#### Gemini API Key
The smart study suggestions feature uses Google's Gemini API for intelligent planning. To deploy this feature:

1. **Get a Gemini API Key**
   - Sign up or log in to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the API key (you'll only see it once)

2. **Add Environment Variable in Vercel**
   - In your Vercel project settings, add a new environment variable:
     - Name: `GEMINI_API_KEY`
     - Value: Your Gemini API key
     - Select all environments (Production, Preview, Development)
   - Click "Save"

### Vercel Deployment

The project is configured for seamless deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure the build settings:
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
3. Set up the required environment variables
4. Deploy

> **Important**: Make sure to set `CI=false` in your environment variables to prevent build failures due to warnings.

## Canvas LMS Integration

Kairos integrates with Canvas LMS through their API. To use this feature:

1. Users need to generate a Canvas API token from their Canvas account
2. The application securely proxies all Canvas API requests through the backend
3. Supported Canvas domains include `*.instructure.com` and `canvas.*.edu` formats

## Security Considerations

- API keys (OpenAI, Canvas) are stored securely in environment variables
- All API calls to third-party services are made through secure backend routes
- User data is processed on the server side, ensuring sensitive information is not exposed
- JWT authentication is used for secure user sessions
- CORS is configured to allow only specific origins

## Browser Compatibility

Kairos is tested and optimized for:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

> **Note**: There are Safari-specific tests for certain components like EventModal to ensure proper display and functionality across browsers.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a pull request

## Troubleshooting

- **Build Failures on Vercel**: Ensure `CI=false` is set in environment variables
- **Testing Issues**: Check that all required mocks are in place, especially for react-router-dom
- **Canvas API Connection Problems**: Verify the Canvas domain format and API token validity
- **OpenAI API Errors**: Check your API key and quota limits
