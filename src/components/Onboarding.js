import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faArrowLeft, faArrowRight, faCheck, faSync, faTimes, faGraduationCap, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import googleCalendarService from '../services/googleCalendarService';
import googleCalendarDbService from '../services/googleCalendarDbService';
import canvasService from '../services/canvasService';
import '../styles/Onboarding.css';
import { isConfigured } from '../config/googleCalendarConfig';

const Onboarding = () => {
  const navigate = useNavigate();
  const { user: authUser, isLoggedIn } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [apiConfigured] = useState(isConfigured());
  
  // Google Calendar states
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });
  
  // Canvas states
  const [isCanvasConnected, setIsCanvasConnected] = useState(false);
  const [canvasStatus, setCanvasStatus] = useState({ status: 'idle', message: '' });
  const [canvasSyncStatus, setCanvasSyncStatus] = useState({ status: 'idle', message: '' });
  const [canvasFormData, setCanvasFormData] = useState({ token: '', domain: '' });
  
  // Sleep schedule state
  const [sleepSchedule, setSleepSchedule] = useState({
    bedtime: '00:00',
    wakeupTime: '08:00'
  });

  // Function to handle sleep schedule changes
  const handleSleepScheduleChange = (e) => {
    const { name, value } = e.target;
    setSleepSchedule(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to calculate hours between bedtime and wakeup
  const calculateSleepHours = () => {
    if (!sleepSchedule.bedtime || !sleepSchedule.wakeupTime) {
      return 8; // Default to 8 hours if not set
    }
    
    // Parse times
    const [bedHours, bedMinutes] = sleepSchedule.bedtime.split(':').map(Number);
    const [wakeHours, wakeMinutes] = sleepSchedule.wakeupTime.split(':').map(Number);
    
    // Convert to minutes since midnight
    let bedTimeMinutes = bedHours * 60 + bedMinutes;
    let wakeTimeMinutes = wakeHours * 60 + wakeMinutes;
    
    // Calculate difference in minutes
    let diffMinutes = wakeTimeMinutes - bedTimeMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Add a day in minutes
    }
    
    // Convert back to hours and minutes
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}${remainingMinutes > 0 ? ` and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
  };

  // Initialize Google Calendar
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
            const signedInUser = googleCalendarService.getCurrentUser();
            setUser(signedInUser);

            // Kairos: After Google sign-in, check DB for sync token and sync accordingly
            const storedUser = localStorage.getItem('userData');
            let userId;
            if (storedUser) {
              const userData = JSON.parse(storedUser);
              userId = userData.id;
            }
            if (userId) {
              // Fetch sync token from DB
              fetch(`/api/users/${userId}/google-sync-token`)
                .then(res => res.json())
                .then(async data => {
                  if (data && data.syncToken) {
                    setSyncStatus({ status: 'loading', message: 'Syncing with Google Calendar...' });
                    await googleCalendarDbService.syncGoogleCalendarWithDb(userId, false);
                    setSyncStatus({ status: 'success', message: 'Google Calendar is up to date.' });
                    window.dispatchEvent(new Event('calendarDataUpdated'));
                    setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
                  } else {
                    setSyncStatus({ status: 'info', message: 'First Google Calendar sync may take a while. Please continue.' });
                    await googleCalendarDbService.syncGoogleCalendarWithDb(userId, true);
                    setSyncStatus({ status: 'success', message: 'Google Calendar sync complete.' });
                    window.dispatchEvent(new Event('calendarDataUpdated'));
                    setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 3000);
                  }
                })
                .catch(err => {
                  setSyncStatus({ status: 'error', message: 'Could not check sync token: ' + err.message });
                  setTimeout(() => setSyncStatus({ status: 'idle', message: '' }), 4000);
                });
            }
            
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

  // Handle Google sign-in
  const handleSignIn = async () => {
    try {
      setSyncStatus({ status: 'loading', message: 'Signing in...' });
      await googleCalendarService.signIn();
      // The sign-in process is handled by the callback in the Google Identity Services
    } catch (error) {
      console.error('Error signing in:', error);
      setSyncStatus({
        status: 'error',
        message: 'Failed to sign in with Google. Please try again.'
      });
    }
  };

  // Handle Canvas form submission
  const handleCanvasSubmit = async (e) => {
    e.preventDefault();
    
    if (!isLoggedIn || !authUser?.id) {
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

  // Handle Canvas sync
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

  // Handle next step
  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Save sleep schedule to database if user is logged in
      if (isLoggedIn && authUser?.id) {
        fetch(`/api/users/${authUser.id}/sleep-schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sleepSchedule)
        }).catch(error => {
          console.error('Error saving sleep schedule:', error);
        });
      }
      
      // Mark onboarding as complete
      if (authUser?.id) {
        localStorage.setItem(`onboarding_complete_${authUser.id}`, 'true');
      }
      navigate('/calendar');
    }
  };

  // Handle previous step
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle skip
  const handleSkip = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mark onboarding as complete even when skipping
      if (authUser?.id) {
        localStorage.setItem(`onboarding_complete_${authUser.id}`, 'true');
      }
      navigate('/calendar');
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-progress">
        <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>1</div>
        <div className="progress-line"></div>
        <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>2</div>
        <div className="progress-line"></div>
        <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>3</div>
      </div>
      
      <div className="onboarding-content">
        {currentStep === 1 && (
          <div className="onboarding-step">
            <h1 data-testid="welcome-title">Welcome to Kairos!</h1>
            <h2 data-testid="google-calendar-title">Connect your Google Calendar</h2>
            
            <div className="google-auth-section">
              {!isSignedIn ? (
                <div className="auth-card">
                  <div className="auth-card-content">
                    <FontAwesomeIcon icon={faGoogle} size="3x" className="google-icon" />
                    <h3>Connect with Google Calendar</h3>
                    <p>Link your Google Calendar to import and export events</p>
                    <button 
                      data-testid="google-signin-button"
                      className="button button-primary google-button"
                      onClick={handleSignIn}
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
                        <h3>{user?.name}</h3>
                        <p>{user?.email}</p>
                      </div>
                    </div>
                    
                    <div className="connected-status">
                      <FontAwesomeIcon icon={faCheck} className="status-icon success" />
                      <span>Connected to Google Calendar</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className={`sync-status ${syncStatus.status}`} style={{ display: syncStatus.status === 'idle' ? 'none' : 'flex' }}>
                <FontAwesomeIcon 
                  icon={
                    syncStatus.status === 'loading' ? faSync :
                    syncStatus.status === 'success' ? faCheck : faTimes
                  } 
                  className={`status-icon ${syncStatus.status === 'loading' ? 'fa-spin' : ''}`}
                />
                {syncStatus.status === 'error' ? (
                  <p data-testid="google-error-message" className="error-message">{syncStatus.message}</p>
                ) : syncStatus.status === 'success' ? (
                  <p data-testid="google-success-message" className="success-message">{syncStatus.message}</p>
                ) : (
                  <span>{syncStatus.message}</span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div className="onboarding-step">
            <h1 data-testid="canvas-title">Connect Canvas LMS</h1>
            <h2>Import your assignments and deadlines</h2>
            
            <div className="canvas-auth-section">
              {!isCanvasConnected ? (
                <div className="auth-card">
                  <div className="auth-card-content">
                    <FontAwesomeIcon icon={faGraduationCap} size="3x" className="canvas-icon" />
                    <h3>Connect with Canvas</h3>
                    <p>Link your Canvas account to import assignments and deadlines</p>
                    <form data-testid="canvas-form" onSubmit={handleCanvasSubmit}>
                      <div className="form-group">
                        <label htmlFor="canvasToken">Canvas Access Token</label>
                        <input
                          data-testid="canvas-token-input"
                          id="canvasToken"
                          placeholder="Enter your Canvas access token"
                          required
                          type="password"
                          value={canvasFormData.token}
                          onChange={(e) => setCanvasFormData({ ...canvasFormData, token: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="canvasDomain">Canvas Domain</label>
                        <input
                          data-testid="canvas-domain-input"
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
                        data-testid="canvas-connect-button"
                        type="submit" 
                        className="button button-primary canvas-button"
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
                        data-testid="canvas-sync-button"
                        className="button button-primary"
                        onClick={handleCanvasSync}
                        disabled={canvasSyncStatus.status === 'loading'}
                      >
                        {canvasSyncStatus.status === 'loading' ? (
                          <>
                            <FontAwesomeIcon icon={faSync} spin /> <span data-testid="canvas-sync-loading">Syncing...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faSync} /> Sync Assignments
                          </>
                        )}
                      </button>
                    </div>
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
                  {canvasStatus.status === 'error' ? (
                    <p data-testid="canvas-error-message" className="error-message">{canvasStatus.message}</p>
                  ) : canvasSyncStatus.status === 'error' ? (
                    <p data-testid="canvas-sync-error-message" className="error-message">{canvasSyncStatus.message}</p>
                  ) : canvasStatus.status === 'success' ? (
                    <p data-testid="canvas-success-message" className="success-message">{canvasStatus.message}</p>
                  ) : canvasSyncStatus.status === 'success' ? (
                    <p data-testid="canvas-sync-success-message" className="success-message">{canvasSyncStatus.message}</p>
                  ) : (
                    <span data-testid="canvas-sync-loading-message">{canvasStatus.message || canvasSyncStatus.message}</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="integration-note">
              <p>Quick setup:</p>
              <ol>
                <li>Go to Canvas {'>'} Account {'>'} Settings {'>'} Scroll to Approved Integrations {'>'} New Access Token</li>
                <li>Enter "Kairos" for Purpose, generate token</li>
                <li>Paste token above and enter your Canvas domain</li>
              </ol>
            </div>
          </div>
        )}
        
        {currentStep === 3 && (
          <div className="onboarding-step">
            <h1 data-testid="sleep-schedule-title">Set Your Sleep Schedule</h1>
            <h2>Help us optimize your study sessions</h2>
            
            <div className="sleep-schedule-section">
              <div className="auth-card">
                <div className="auth-card-content">
                  <div className="sleep-schedule-form">
                    <h3>Your Sleep Schedule</h3>
                    <p className="sleep-schedule-description">
                      Set your typical sleep hours so we can avoid scheduling preparation sessions during this time.
                    </p>
                    
                    <div className="sleep-schedule-inputs">
                      <div className="form-group">
                        <label htmlFor="bedtime">
                          <FontAwesomeIcon icon={faMoon} className="schedule-icon" /> Bedtime
                        </label>
                        <input
                          data-testid="bedtime-input"
                          type="time"
                          id="bedtime"
                          name="bedtime"
                          value={sleepSchedule.bedtime}
                          onChange={handleSleepScheduleChange}
                          className="time-input"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="wakeupTime">
                          <FontAwesomeIcon icon={faSun} className="schedule-icon" /> Wake-up Time
                        </label>
                        <input
                          data-testid="wakeup-time-input"
                          type="time"
                          id="wakeupTime"
                          name="wakeupTime"
                          value={sleepSchedule.wakeupTime}
                          onChange={handleSleepScheduleChange}
                          className="time-input"
                        />
                      </div>
                    </div>
                    
                    <p className="sleep-hours-note">
                      We will not schedule any events during the {calculateSleepHours()} you are asleep.
                    </p>
                    
                    <div className="sleep-schedule-info">
                      <h4>Why this matters:</h4>
                      <ul>
                        <li>Kairos will avoid scheduling study sessions during your sleep hours</li>
                        <li>This helps create a more balanced and effective study plan</li>
                        <li>You can always update this information later in the Study Suggestions page</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="onboarding-actions">
          {currentStep > 1 && (
            <button data-testid="back-button" className="button button-secondary" onClick={handleBack}>
              <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>
          )}
          
          <button data-testid="skip-button" className="button button-text" onClick={handleSkip}>
            Skip
          </button>
          
          <button data-testid="next-button" className="button button-primary" onClick={handleNext}>
            {currentStep < 3 ? 'Next' : 'Go to Calendar'} <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
