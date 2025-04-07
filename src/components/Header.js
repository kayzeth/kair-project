import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUserCircle, faFileAlt, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import logo2 from '../assets/images/logo2.png';
import Tooltip from '../tooltip';
import { useAuth } from '../context/AuthContext';

const Header = ({ activeTab, onTabChange }) => {
  // Always call hooks at the top level
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  // Provide fallback values for testing environment
  const isLoggedIn = auth?.isLoggedIn ?? false;
  const logout = auth?.logout ?? (() => {});
  const isLandingPage = location?.pathname === '/';

  console.log('DIAGNOSTIC: Header - Current location:', location.pathname);
  console.log('DIAGNOSTIC: Header - Active tab:', activeTab);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header" data-testid="header">
      <div className="logo-container">
        <Link 
          to={isLoggedIn ? '/calendar' : '/'} 
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}
        >
          <img src={logo2} alt="Kairos Logo" className="logo" data-testid="header-logo" />
          <h1 className="app-title" data-testid="header-title">Kairos</h1>
        </Link>
      </div>

      <div className="nav-links">
        {!isLandingPage && (
          <>
            <Link 
              to="/calendar" 
              className="nav-link" 
              data-testid="header-nav-calendar"
              onClick={() => onTabChange('calendar')}
            >
              <Tooltip text="Calendar">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </Tooltip>
            </Link>
            <Link 
              to="/syllabusParser" 
              className="nav-link" 
              data-testid="header-nav-syllabus"
              onClick={() => onTabChange('syllabusParser')}
            >
              <Tooltip text="Syllabus Parser">
                <FontAwesomeIcon icon={faFileAlt} />
              </Tooltip>
            </Link>
            <Link 
              to="/account" 
              className="nav-link" 
              data-testid="header-nav-account"
              onClick={() => onTabChange('account')}
            >
              <Tooltip text="Account">
                <FontAwesomeIcon icon={faUserCircle} size="lg" />
              </Tooltip>
            </Link>
            <Link 
              to="/" 
              className="nav-link logout-button" 
              data-testid="header-nav-logout"
              onClick={handleLogout}
            >
              <Tooltip text="Log Out">
                <FontAwesomeIcon icon={faSignOutAlt} />
              </Tooltip>
            </Link>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
