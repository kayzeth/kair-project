import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Calendar from './components/Calendar';
import Account from './components/Account';
import SyllabusParser from './components/SyllabusParser';
import Landing from './components/Landing';
import { AuthProvider } from './context/AuthContext';
import './styles/App.css';
import './styles/Account.css';
import './styles/SyllabusParser.css';
import './styles/Landing.css';

function App() {
  const [activeTab, setActiveTab] = React.useState('calendar');
  const [events, setEvents] = React.useState([]);

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
    <AuthProvider>
      <Router>
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
                element={<Calendar data-testid="calendar-component" initialEvents={events} />}
              />
              <Route path="/account" element={<Account />} />
              <Route 
                path="/syllabusParser" 
                element={<SyllabusParser onAddEvents={handleAddEvents} />} 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
