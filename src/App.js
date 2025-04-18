import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Calendar from './components/Calendar';
import Account from './components/Account';
import SyllabusParser from './components/SyllabusParser';
import Landing from './components/Landing';
import Onboarding from './components/Onboarding';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getCurrentUserId } from './services/userService';
import './styles/App.css';
import './styles/Account.css';
import './styles/SyllabusParser.css';
import './styles/Landing.css';

function AppContent() {
  const [activeTab, setActiveTab] = React.useState('calendar');
  const [events, setEvents] = React.useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get user ID from auth context or userService, or use a temporary ID for testing
  // This ensures we always have a user ID for testing the MongoDB integration
  const userId = user?.id || getCurrentUserId() || '6574a7d5b5a7f3001c8f8f8f'; // Temporary ID for testing

  console.log('DIAGNOSTIC: App.js - Current user ID:', userId);
  console.log('DIAGNOSTIC: App.js - Current location:', location.pathname);

  const handleTabChange = (tab) => {
    console.log('DIAGNOSTIC: App.js - Tab change requested to:', tab);
    setActiveTab(tab);
    
    // Use direct navigation instead of state changes
    if (tab === 'calendar') {
      console.log('DIAGNOSTIC: App.js - Navigating to calendar');
      navigate('/calendar');
    } else if (tab === 'account') {
      console.log('DIAGNOSTIC: App.js - Navigating to account');
      navigate('/account');
    } else if (tab === 'syllabusParser') {
      console.log('DIAGNOSTIC: App.js - Navigating to syllabus parser');
      navigate('/syllabusParser');
    }
  };

  const handleAddEvents = (newEvents) => {
    if (newEvents && newEvents.length > 0) {
      console.log('DIAGNOSTIC: App.js - Adding new events:', newEvents.length);
      setEvents(prevEvents => [...prevEvents, ...newEvents]);
      // Switch to calendar tab to show the newly added events
      handleTabChange('calendar');
    }
  };

  return (
    <div className="app-container" data-testid="app-container">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={<Landing />}
          />
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute>
                <Calendar 
                  data-testid="calendar-component" 
                  initialEvents={events} 
                  userId={userId}
                />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/account" 
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/syllabusParser" 
            element={
              <ProtectedRoute>
                <SyllabusParser onAddEvents={handleAddEvents} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
