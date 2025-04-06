import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Calendar from './components/Calendar';
import Account from './components/Account';
import SyllabusParser from './components/SyllabusParser';
import Landing from './components/Landing';
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
  
  // Get user ID from auth context or userService, or use a temporary ID for testing
  // This ensures we always have a user ID for testing the MongoDB integration
  const userId = user?.id || getCurrentUserId() || '6574a7d5b5a7f3001c8f8f8f'; // Temporary ID for testing

  console.log('Current user ID:', userId);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleAddEvents = (newEvents) => {
    if (newEvents && newEvents.length > 0) {
      setEvents(prevEvents => [...prevEvents, ...newEvents]);
      // Switch to calendar tab to show the newly added events
      setActiveTab('calendar');
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
              <Calendar 
                data-testid="calendar-component" 
                initialEvents={events} 
                userId={userId}
              />
            }
          />
          <Route path="/account" element={<Account />} />
          <Route 
            path="/syllabusParser" 
            element={<SyllabusParser onAddEvents={handleAddEvents} />} 
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
