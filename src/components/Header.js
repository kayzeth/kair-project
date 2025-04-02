import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUserCircle, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import logo2 from '../assets/images/logo2.png';
import Tooltip from '../tooltip';

const Header = ({ activeTab, onTabChange }) => {
  return (
    <header className="header" data-testid="header">
      <div className="logo-container">
        <Link 
          to="/" 
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
        >
          <img src={logo2} alt="Kairos Logo" className="logo" data-testid="header-logo" />
          <h1 className="app-title" data-testid="header-title">Kairos</h1>
        </Link>
      </div>

      <div className="nav-links">
        <Link to="/" className="nav-link" data-testid="header-nav-calendar">
          <Tooltip text="Calendar">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </Tooltip>
        </Link>
        <Link to="/syllabusParser" className="nav-link" data-testid="header-nav-syllabus">
          <Tooltip text="Syllabus Parser">
            <FontAwesomeIcon icon={faFileAlt} />
          </Tooltip>
        </Link>
        <Link to="/account" className="nav-link" data-testid="header-nav-account">
          <Tooltip text="Account">
            <FontAwesomeIcon icon={faUserCircle} size="lg" />
          </Tooltip>
        </Link>
      </div>
    </header>
  );
};

export default Header;
