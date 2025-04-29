import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faUserCircle, faFileAlt, faSignOutAlt, faBookReader } from '@fortawesome/free-solid-svg-icons';
import logo2 from '../assets/images/logo2.png';
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

  // Don't render anything on the landing page
  if (isLandingPage) {
    return null;
  }
  
  // Check if we're on the onboarding page
  const isOnboardingPage = location.pathname === '/onboarding';

  return (
    <aside className="sidebar" data-testid="header">
      <div className="sidebar-content">
        <div className="logo-container">
          <Link 
            to={isLoggedIn ? '/calendar' : '/'} 
            className="logo-link"
            data-testid="header-logo-link"
          >
            <img src={logo2} alt="Kairos Logo" className="logo" data-testid="header-logo" />
            <h1 className="app-title" data-testid="header-title">Kairos</h1>
          </Link>
        </div>

        {!isOnboardingPage && (
          <>
            <nav className="sidebar-nav">
              <ul className="nav-list">
                <li className="nav-item">
                  <Link 
                    to="/calendar" 
                    className={`nav-link ${activeTab === 'calendar' ? 'active' : ''}`}
                    data-testid="header-nav-calendar"
                    onClick={() => onTabChange('calendar')}
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} className="nav-icon" />
                    <span className="nav-text">Calendar</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/account" 
                    className={`nav-link ${activeTab === 'account' ? 'active' : ''}`}
                    data-testid="header-nav-account"
                    onClick={() => onTabChange('account')}
                  >
                    <FontAwesomeIcon icon={faUserCircle} className="nav-icon" />
                    <span className="nav-text">Account</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/syllabusParser" 
                    className={`nav-link ${activeTab === 'syllabusParser' ? 'active' : ''}`}
                    data-testid="header-nav-syllabus"
                    onClick={() => onTabChange('syllabusParser')}
                  >
                    <FontAwesomeIcon icon={faFileAlt} className="nav-icon" />
                    <span className="nav-text">Syllabus Parser</span>
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    to="/studySuggestions" 
                    className={`nav-link ${activeTab === 'studySuggestions' ? 'active' : ''}`}
                    data-testid="header-nav-study-suggestions"
                    onClick={() => onTabChange('studySuggestions')}
                  >
                    <FontAwesomeIcon icon={faBookReader} className="nav-icon" />
                    <span className="nav-text">Study Suggestions</span>
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="sidebar-footer">
              <Link 
                to="/" 
                className="nav-link logout-button" 
                data-testid="header-nav-logout"
                onClick={handleLogout}
              >
                <FontAwesomeIcon icon={faSignOutAlt} className="nav-icon" />
                <span className="nav-text">Log Out</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default Header;
