import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faSync, faCheck, faTimes, faCalendarAlt, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import googleCalendarService from '../services/googleCalendarService';
import googleCalendarLocalStorageService from '../services/googleCalendarLocalStorageService';
import canvasService from '../services/canvasService';
import { isConfigured } from '../config/googleCalendarConfig';
import { isConfigured as isCanvasConfigured } from '../config/canvasConfig';
import ApiKeyInput from './ApiKeyInput';

const Account = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [apiConfigured] = useState(isConfigured());
  const [canvasStatus, setCanvasStatus] = useState({ status: 'idle', message: '' });
  const [canvasSyncStatus, setCanvasSyncStatus] = useState({ status: 'idle', message: '' });
  const [canvasFormData, setCanvasFormData] = useState({ token: '', domain: '' });
  const [isCanvasConnected, setIsCanvasConnected] = useState(isCanvasConfigured());

  useEffect(() => {
    const initializeGoogleCalendar = async () => {
      // Check if API credentials are configured
      if (!apiConfigured) {
        setSyncStatus({
          status: 'error',
          message: 'Google Calendar API credentials are not configured. Please add your API credentials to continue.'
        });
        return;
      }
      
      setSyncStatus({ status: 'loading', message: 'Initializing Google Calendar...' });
      
      try {
        await googleCalendarService.initialize();
        
        // Set initial sign-in state
        const initialSignInState = googleCalendarService.isSignedIn();
        setIsSignedIn(initialSignInState);
        
        if (initialSignInState) {
          setUser(googleCalendarService.getCurrentUser());
          setSyncStatus({ status: 'success', message: 'Successfully connected to Google Calendar' });
          setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
        } else {
          setSyncStatus({ status: 'idle', message: '' });
        }
        
        // Add listener for sign-in state changes
        googleCalendarService.addSignInListener((isSignedIn) => {
          setIsSignedIn(isSignedIn);
          if (isSignedIn) {
            setUser(googleCalendarService.getCurrentUser());
            setSyncStatus({ status: 'success', message: 'Successfully signed in to Google Calendar' });
            setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
          } else {
            setUser(null);
            setSyncStatus({ status: 'idle', message: '' });
          }
        });
      } catch (error) {
        console.error('Error initializing Google Calendar service:', error);
        setSyncStatus({
          status: 'error',
          message: error.message || 'Failed to initialize Google Calendar API'
        });
      }
    };

    initializeGoogleCalendar();
  }, [apiConfigured]);

  // Handle sign-in button click
  const handleSignIn = async () => {
    try {
      setSyncStatus({ status: 'loading', message: 'Signing in...' });
      await googleCalendarService.signIn();
      // The sign-in process is handled by the callback in the Google Identity Services
      // The status will be updated by the sign-in listener in useEffect
    } catch (error) {
      console.error('Error signing in:', error);
      setSyncStatus({
        status: 'error',
        message: 'Failed to sign in with Google. Please try again.'
      });
    }
  };

  // Handle sign-out button click
  const handleSignOut = async () => {
    try {
      setSyncStatus({ status: 'loading', message: 'Signing out...' });
      await googleCalendarService.signOut();
      setSyncStatus({ status: 'idle', message: '' });
    } catch (error) {
      console.error('Error signing out:', error);
      setSyncStatus({
        status: 'error',
        message: 'Failed to sign out from Google. Please try again.'
      });
    }
  };

  // Sync with Google Calendar (both import and export)
  const syncWithGoogleCalendar = async () => {
    if (!isSignedIn) {
      handleSignIn();
      return;
    }

    setSyncStatus({ status: 'loading', message: 'Syncing with Google Calendar...' });

    try {
      // Force sync with Google Calendar and store in local storage
      const events = await googleCalendarLocalStorageService.forceSyncGoogleCalendar();
      console.log(`Synced ${events.length} events from Google Calendar to local storage`);
      
      // Success message - use a consistent message for tests
      setSyncStatus({
        status: 'success',
        message: 'Successfully synced with Google Calendar'
      });
      
      // Dispatch an event to notify the Calendar component to refresh
      setTimeout(() => {
        console.log('Dispatching calendar update event...');
        window.dispatchEvent(new Event('calendarEventsUpdated'));
      }, 500);
      
      // Set a longer timeout to ensure user sees the message before it disappears
      setTimeout(() => {
        setSyncStatus({ status: 'idle', message: '' });
      }, 5000);
      
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      setSyncStatus({
        status: 'error',
        message: `Failed to sync with Google Calendar: ${error.message}`
      });
    }
  };

  const handleCanvasSubmit = async (e) => {
    e.preventDefault();
    setCanvasStatus({ status: 'loading', message: 'Connecting to Canvas...' });
    try {
      // Pass the raw token and domain to canvasService
      await canvasService.setCredentials(canvasFormData.token, canvasFormData.domain);
      await canvasService.testConnection();
      setIsCanvasConnected(true);
      setCanvasStatus({ 
        status: 'success', 
        message: 'Successfully connected to Canvas!' 
      });
      setTimeout(() => setCanvasStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      console.error('Canvas connection error:', error);
      setCanvasStatus({
        status: 'error',
        message: 'Failed to connect to Canvas. Please check your credentials.'
      });
      setTimeout(() => setCanvasStatus({ status: 'idle', message: '' }), 3000);
    }
  };

  const handleCanvasSync = async () => {
    setCanvasSyncStatus({ status: 'loading', message: 'Syncing Canvas assignments...' });
    try {
      const eventCount = await canvasService.syncWithCalendar();
      
      // Force a refresh of the calendar events by triggering a window event
      window.dispatchEvent(new Event('calendarEventsUpdated'));
      
      setCanvasSyncStatus({ 
        status: 'success', 
        message: `Successfully imported ${eventCount} Canvas assignments!` 
      });
      setTimeout(() => setCanvasSyncStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      console.error('Canvas sync error:', error);
      setCanvasSyncStatus({
        status: 'error',
        message: 'Failed to sync Canvas assignments. Please try again.'
      });
      setTimeout(() => setCanvasSyncStatus({ status: 'idle', message: '' }), 3000);
    }
  };

  return (
    <div className="account-container">
      <h1 className="account-title" data-testid="account-title">Account Settings</h1>

      {/* API Key Input section */}
      <ApiKeyInput onApiKeySubmit={(apiKey) => {
        // If apiKey is null, it means it was cleared
        if (apiKey === null) {
          setSyncStatus({
            status: 'info',
            message: 'API key has been cleared'
          });
        } else {
          setSyncStatus({
            status: 'success',
            message: 'API key updated successfully'
          });
        }
        
        // Reset status message after a delay
        setTimeout(() => {
          setSyncStatus({ status: 'idle', message: '' });
        }, 3000);
      }} />
      
      {!apiConfigured && (
        <div className="api-credentials-warning">
          <h2 data-testid="api-credentials-warning">Google Calendar API Credentials Required</h2>
          <p>To use Google Calendar integration, you need to configure your API credentials:</p>
          <ol>
            <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
            <li>Create a new project</li>
            <li>Enable the Google Calendar API</li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add authorized JavaScript origins for your domain (e.g., http://localhost:3000 for development)</li>
            <li>Add authorized redirect URIs (e.g., http://localhost:3000 for development)</li>
            <li>Copy the API key and Client ID</li>
            <li>Add them to your project in one of these ways:
              <ul>
                <li>Create a <code>.env</code> file in your project root with:
                  <pre>REACT_APP_GOOGLE_API_KEY=your_api_key_here
REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here</pre>
                </li>
                <li>Or update the values directly in <code>src/config/googleCalendarConfig.js</code></li>
              </ul>
            </li>
            <li>Restart your development server</li>
          </ol>
        </div>
      )}
      
      <div className="account-section">
        <h2 className="section-title">User Profile</h2>
        
        <div className="profile-section">
          <div className="profile-info">
            <div className="profile-avatar">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="profile-image" />
              ) : (
                <div className="profile-placeholder">
                  <FontAwesomeIcon icon={faCalendarAlt} size="2x" />
                </div>
              )}
            </div>
            <div className="profile-details">
              <h3 data-testid="user-name">{user?.name || 'Kairos User'}</h3>
              <p data-testid="user-email">{user?.email || 'Sign in to sync your calendar'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="account-section">
        <h2 className="section-title">Google Calendar Integration</h2>
        
        <div className="google-auth-section">
          {!isSignedIn ? (
            <div className="auth-card">
              <div className="auth-card-content">
                <FontAwesomeIcon icon={faGoogle} size="3x" className="google-icon" />
                <h3>Connect with Google Calendar</h3>
                <p>Link your Google Calendar to import and export events</p>
                <button 
                  className="button button-primary google-button"
                  onClick={handleSignIn}
                  data-testid="google-sign-in-button"
                >
                  <FontAwesomeIcon icon={faGoogle} /> Sign in with Google
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-card">
              <div className="auth-card-content">
                <div className="user-profile">
                  {user?.imageUrl && (
                    <img 
                      src={user.imageUrl} 
                      alt={user.name} 
                      className="profile-image" 
                    />
                  )}
                  <div className="user-info">
                    <h3 data-testid="auth-user-name">{user?.name}</h3>
                    <p data-testid="auth-user-email">{user?.email}</p>
                  </div>
                </div>
                
                <div className="connected-status">
                  <FontAwesomeIcon icon={faCheck} className="status-icon success" />
                  <span data-testid="google-connected-status">Connected to Google Calendar</span>
                </div>
                
                <div className="google-actions">
                  <button 
                    className="button button-primary"
                    onClick={syncWithGoogleCalendar}
                    data-testid="sync-button"
                  >
                    <FontAwesomeIcon icon={faSync} /> Sync Calendar
                  </button>
                </div>
                
                <button 
                  className="button button-text"
                  onClick={handleSignOut}
                  data-testid="google-disconnect-button"
                >
                  Disconnect Google Account
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Always render the sync status container for testing purposes, but hide it with CSS when idle */}
        <div className={`sync-status ${syncStatus.status}`} style={{ display: syncStatus.status === 'idle' ? 'none' : 'flex' }}>
          <FontAwesomeIcon 
            icon={
              syncStatus.status === 'loading' ? faSync :
              syncStatus.status === 'success' ? faCheck : faTimes
            } 
            className={`status-icon ${syncStatus.status === 'loading' ? 'fa-spin' : ''}`}
          />
          <span data-testid="sync-message">{syncStatus.message}</span>
        </div>
        
        <div className="integration-note">
          <p>
            <strong>Note:</strong> To use Google Calendar integration, you need to:
          </p>
          <ol>
            <li>Sign in with your Google account.</li>
            <li>Allow Kairos to access your Google Calendar.</li>
            <li>Kairos will import your Google Calendar events.</li>
            <li>Kairos will export your Google Calendar events.</li>
          </ol>
          <p>After the initial sync, a sync button will be available for you to manually sync your Google Calendar events.</p>
        </div>
      </div>
      
      <div className="account-section">
        <h2 className="section-title">Canvas Integration</h2>
        
        <div className="integration-container">
          <div className="auth-section">
            {!isCanvasConnected ? (
              <div className="auth-card">
                <div className="auth-card-content">
                  <FontAwesomeIcon icon={faGraduationCap} size="3x" className="canvas-icon" />
                  <h3 data-testid="canvas-connect-title">Connect with Canvas</h3>
                  <p>Link your Canvas account to import assignments and deadlines</p>
                  <form onSubmit={handleCanvasSubmit} className="canvas-form">
                    <div className="form-group">
                      <label htmlFor="canvasToken" data-testid="canvas-token-label">Canvas API Token</label>
                      <input
                        type="password"
                        id="canvasToken"
                        data-testid="account-canvas-token-input"
                        value={canvasFormData.token}
                        onChange={(e) => setCanvasFormData(prev => ({ ...prev, token: e.target.value }))}
                        placeholder="Enter your Canvas token"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="canvasDomain" data-testid="canvas-domain-label">Canvas Domain</label>
                      <input
                        type="text"
                        id="canvasDomain"
                        data-testid="account-canvas-domain-input"
                        value={canvasFormData.domain}
                        onChange={(e) => setCanvasFormData(prev => ({ ...prev, domain: e.target.value }))}
                        placeholder="Enter your school name (e.g., harvard)"
                        required
                      />
                      <small className="form-help">
                        We'll automatically format it as canvas.*.edu
                      </small>
                    </div>
                    <button 
                      type="submit" 
                      className="button button-primary canvas-button"
                      data-testid="account-connect-canvas-button"
                      disabled={canvasStatus.status === 'loading'}
                    >
                      <FontAwesomeIcon icon={faGraduationCap} />
                      {canvasStatus.status === 'loading' ? 'Connecting...' : 'Connect Canvas'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="auth-card">
                <div className="auth-card-content">
                  <div className="canvas-profile">
                    <div className="canvas-icon-container">
                      <FontAwesomeIcon icon={faGraduationCap} size="3x" className="canvas-icon" />
                    </div>
                    <div className="canvas-info">
                      <h3>Canvas Connected</h3>
                      <p>Your Canvas account is linked and ready to sync</p>
                    </div>
                  </div>
                  
                  <div className="connected-status">
                    <FontAwesomeIcon icon={faCheck} className="status-icon success" />
                    <span>Connected to Canvas LMS</span>
                  </div>
                  
                  <div className="canvas-actions">
                    <button 
                      className="button button-primary"
                      data-testid="account-sync-canvas-button"
                      onClick={handleCanvasSync}
                      disabled={canvasSyncStatus.status === 'loading'}
                    >
                      <FontAwesomeIcon icon={faSync} className={canvasSyncStatus.status === 'loading' ? 'fa-spin' : ''} />
                      {canvasSyncStatus.status === 'loading' ? 'Syncing...' : 'Sync Assignments'}
                    </button>
                  </div>
                  
                  <button 
                    className="button button-text"
                    data-testid="account-disconnect-canvas-button"
                    onClick={() => {
                      canvasService.clearCredentials();
                      setIsCanvasConnected(false);
                    }}
                  >
                    Disconnect Canvas Account
                  </button>
                </div>
              </div>
            )}
            
            {(canvasStatus.status !== 'idle' || canvasSyncStatus.status !== 'idle') && (
              <div className={`sync-status ${canvasStatus.status !== 'idle' ? canvasStatus.status : canvasSyncStatus.status}`}>
                <FontAwesomeIcon 
                  icon={
                    (canvasStatus.status === 'loading' || canvasSyncStatus.status === 'loading') ? faSync :
                    (canvasStatus.status === 'success' || canvasSyncStatus.status === 'success') ? faCheck : faTimes
                  } 
                  className={`status-icon ${(canvasStatus.status === 'loading' || canvasSyncStatus.status === 'loading') ? 'fa-spin' : ''}`}
                />
                <span data-testid="canvas-error-message">{canvasStatus.message || canvasSyncStatus.message}</span>
              </div>
            )}
          </div>

          <div className="integration-note">
            <p>
              <strong>Note:</strong> To use Canvas integration, you need to:
            </p>
            <ol>
              <li>Go to Canvas {'>'} Settings {'>'} Developer {'>'} Approved Integrations {'>'} New Access Token</li>
              <li>Enter "Kairos" for "Purpose" and leave the expiration fields blank. Click "Generate Token".</li>
              <li>Copy the generated token and paste it into the "Canvas Access Token" field in your Kairos account.</li>
              <li>Enter your school name (e.g., harvard).</li>
              <li>Use the sync button to import your Canvas assignments.</li>
            </ol>
            <p>After the initial sync, a sync button will be available for you to manually sync your Canvas assignments, announcements, quizzes, and events. Kairos can automate creating these events for you.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
