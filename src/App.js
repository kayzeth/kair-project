import React from 'react';
import Header from './components/Header';
import Calendar from './components/Calendar';
import './styles/App.css';

function App() {
  return (
    <div className="app-container" data-testid="app-container">
      <Header />
      <main className="main-content">
        <Calendar data-testid="calendar-component" />
      </main>
    </div>
  );
}

export default App;
