import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUserCircle, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import logo from '../assets/images/logo.svg';

const Header = ({ activeTab, onTabChange }) => {
  return (
    <header className="header" data-testid="header">
      <div className="logo-container">
        <Link 
          to="/" 
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
        >
          <img src={logo} alt="Kairos Logo" className="logo" data-testid="header-logo" />
          <h1 className="app-title" data-testid="header-title">Kairos</h1>
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/" className="nav-link" data-testid="header-nav-calendar">
          <FontAwesomeIcon icon={faCalendarAlt} /> Calendar
        </Link>
        <Link to="/syllabusParser" className="nav-link" data-testid="header-nav-syllabus">
          <FontAwesomeIcon icon={faFileAlt} /> Syllabus Parser
        </Link>
        <Link to="/account" className="nav-link account-link" data-testid="header-nav-account">
          <FontAwesomeIcon icon={faUserCircle} size="lg" />
          <span className="account-text">Account</span>
        </Link>
      </div>
    </header>
  );
};

export default Header;
