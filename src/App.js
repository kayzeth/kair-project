import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Calendar from './components/Calendar';
import Account from './components/Account';
import SyllabusParser from './components/SyllabusParser';
import './styles/App.css';
import './styles/Account.css';
import './styles/SyllabusParser.css';

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
    <Router>
      <div className="app-container" data-testid="app-container">
        <Header activeTab={activeTab} onTabChange={handleTabChange} />
        <main className="main-content">
          <Routes>
            <Route 
              path="/" 
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
  );
}

export default App;
