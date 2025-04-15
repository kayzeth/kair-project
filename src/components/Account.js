import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faSync, faCheck, faTimes, faCalendarAlt, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import googleCalendarService from '../services/googleCalendarService';
import googleCalendarLocalStorageService from '../services/googleCalendarLocalStorageService';
import canvasService from '../services/canvasService';
import { isConfigured } from '../config/googleCalendarConfig';
import ApiKeyInput from './ApiKeyInput';

const Account = () => {
  const { user: authUser, isLoggedIn } = useAuth();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  const [apiConfigured] = useState(isConfigured());
  const [canvasStatus, setCanvasStatus] = useState({ status: 'idle', message: '' });
  const [canvasSyncStatus, setCanvasSyncStatus] = useState({ status: 'idle', message: '' });
  const [canvasFormData, setCanvasFormData] = useState({ token: '', domain: '' });
  const [isCanvasConnected, setIsCanvasConnected] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('Auth state:', { isLoggedIn, authUser });
  }, [isLoggedIn, authUser]);

  // Check Canvas connection status on component mount and when authUser changes
  useEffect(() => {
    const checkCanvasConnection = async () => {
      if (!isLoggedIn || !authUser?.id) return;
      
      try {
        const response = await fetch(`${process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api'}/lmsintegration`);
        if (!response.ok) {
          throw new Error('Failed to fetch LMS integrations');
        }
        
        const integrations = await response.json();
        const hasCanvasIntegration = integrations.some(
          integration => integration.user_id === authUser.id && integration.lms_type === 'CANVAS'
        );
        
        setIsCanvasConnected(hasCanvasIntegration);
      } catch (error) {
        console.error('Failed to check Canvas connection:', error);
        setIsCanvasConnected(false);
      }
    };

    checkCanvasConnection();
  }, [isLoggedIn, authUser?.id]);

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
          const googleUser = googleCalendarService.getCurrentUser();
          setUser(googleUser);
          setSyncStatus({ status: 'success', message: 'Successfully connected to Google Calendar' });
          setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
        } else {
          setSyncStatus({ status: 'idle', message: '' });
        }
        
        // Add listener for sign-in state changes
        googleCalendarService.addSignInListener((isSignedIn) => {
          setIsSignedIn(isSignedIn);
          if (isSignedIn) {
            const googleUser = googleCalendarService.getCurrentUser();
            setUser(googleUser);
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
      
      // Success message
      setSyncStatus({
        status: 'success',
        message: `Successfully synced ${events.length} events from Google Calendar`
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
    console.log('Canvas submit - Auth state:', { isLoggedIn, authUser });
    
    if (!isLoggedIn || !authUser?.id) {
      console.log('Auth check failed:', { isLoggedIn, authUser });
      setCanvasStatus({ 
        status: 'error', 
        message: 'Please log in to connect your Canvas account' 
      });
      return;
    }

    setCanvasStatus({ status: 'loading', message: 'Connecting to Canvas...' });
    
    try {
      await canvasService.setCredentials(canvasFormData.token, canvasFormData.domain, authUser.id);
      setIsCanvasConnected(true);
      setCanvasStatus({ status: 'success', message: 'Successfully connected to Canvas' });
      setTimeout(() => setCanvasStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      console.error('Canvas connection error:', error);
      setCanvasStatus({ 
        status: 'error', 
        message: error.message || 'Failed to connect to Canvas' 
      });
      setIsCanvasConnected(false);
    }
  };

  const handleCanvasSync = async () => {
    if (!isLoggedIn || !authUser?.id) {
      setCanvasSyncStatus({ 
        status: 'error', 
        message: 'Please log in to sync your Canvas account' 
      });
      return;
    }

    setCanvasSyncStatus({ status: 'loading', message: 'Syncing with Canvas...' });
    
    try {
      const eventsAdded = await canvasService.syncWithCalendar(authUser.id);
      setCanvasSyncStatus({ 
        status: 'success', 
        message: `Successfully synced ${eventsAdded} events from Canvas` 
      });
      setTimeout(() => setCanvasSyncStatus({ status: 'idle', message: '' }), 3000);
    } catch (error) {
      console.error('Canvas sync error:', error);
      setCanvasSyncStatus({ 
        status: 'error', 
        message: error.message || 'Failed to sync with Canvas' 
      });
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
        
        {syncStatus.status !== 'idle' && (
          <div className={`sync-status ${syncStatus.status}`}>
            <FontAwesomeIcon 
              icon={
                syncStatus.status === 'loading' ? faSync :
                syncStatus.status === 'success' ? faCheck : faTimes
              } 
              className={`status-icon ${syncStatus.status === 'loading' ? 'fa-spin' : ''}`}
            />
            <span data-testid="sync-message">{syncStatus.message}</span>
          </div>
        )}
        
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
        
        <div className="canvas-auth-section">
          {!isCanvasConnected ? (
            <div className="auth-card">
              <div className="auth-card-content">
                <FontAwesomeIcon icon={faGraduationCap} size="3x" className="canvas-icon" />
                <h3>Connect with Canvas</h3>
                <p>Link your Canvas account to import assignments and deadlines</p>
                <form onSubmit={handleCanvasSubmit}>
                  <div className="form-group">
                    <label
                      data-testid="canvas-token-label"
                      htmlFor="canvasToken"
                    >
                      Canvas Access Token
                    </label>
                    <input
                      data-testid="account-canvas-token-input"
                      id="canvasToken"
                      placeholder="Enter your Canvas access token"
                      required
                      type="password"
                      value={canvasFormData.token}
                      onChange={(e) => setCanvasFormData({ ...canvasFormData, token: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label
                      data-testid="canvas-domain-label"
                      htmlFor="canvasDomain"
                    >
                      Canvas Domain
                    </label>
                    <input
                      data-testid="account-canvas-domain-input"
                      id="canvasDomain"
                      placeholder="ex. canvas.harvard.edu OR harvard.instructure.com"
                      required
                      type="text"
                      value={canvasFormData.domain}
                      onChange={(e) => setCanvasFormData({ ...canvasFormData, domain: e.target.value })}
                    />
                    <small className="form-help">
                      Please enter your institution's full Canvas domain. You can find this in your Canvas URL when you log in.
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
                  onClick={async () => {
                    if (!isLoggedIn || !authUser?.id) {
                      setCanvasStatus({
                        status: 'error',
                        message: 'Please log in to disconnect your Canvas account'
                      });
                      return;
                    }

                    try {
                      await canvasService.clearCredentials(authUser.id);
                      setIsCanvasConnected(false);
                    } catch (error) {
                      console.error('Failed to clear Canvas credentials:', error);
                      setCanvasStatus({
                        status: 'error',
                        message: 'Failed to disconnect Canvas account'
                      });
                    }
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
          <h2 data-testid="canvas-instructions">Canvas Integration Instructions</h2>
          <p>To use Canvas integration, you need to configure your access token:</p>
          <ol>
            <li>Go to Canvas {'>'} Settings {'>'} Developer {'>'} Approved Integrations {'>'} New Access Token</li>
            <li>Enter "Kairos" for "Purpose" and leave the expiration fields blank. Click "Generate Token"</li>
            <li>Copy the generated token and paste it into the "Canvas Access Token" field in your Kairos account</li>
            <li>Enter your institution's full Canvas domain (e.g., canvas.harvard.edu or harvard.instructure.com)</li>
            <li>Use the sync button to import your Canvas assignments</li>
          </ol>
          <p>After the initial sync, a sync button will be available for you to manually sync your Canvas assignments, announcements, quizzes, and events. Kairos can automate creating these events for you.</p>
      </div>
      </div>
    </div>
  );
};

export default Account;
