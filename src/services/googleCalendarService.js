import { GOOGLE_API_CONFIG, isConfigured } from '../config/googleCalendarConfig';

/**
 * Service for handling Google Calendar API interactions
 */
class GoogleCalendarService {
  constructor() {
    this.isInitialized = false;
    this.tokenClient = null;
    this.signInListeners = [];
    this.currentUser = null;
  }

  /**
   * Initialize the Google API client
   * @returns {Promise} Promise that resolves when the API is initialized
   */
  async initialize() {
    if (this.isInitialized) return Promise.resolve();
    
    // Check if API credentials are configured
    if (!isConfigured()) {
      console.error('Google Calendar API credentials are not configured.');
      return Promise.reject(new Error('Google Calendar API credentials are not configured'));
    }

    return new Promise((resolve, reject) => {
      const loadScripts = async () => {
        try {
          // Step 1: Load the GAPI client for API calls
          if (!window.gapi) {
            await this.loadScript('https://apis.google.com/js/api.js');
          }
          
          // Step 2: Initialize the GAPI client
          await new Promise((resolveGapi) => {
            window.gapi.load('client', async () => {
              try {
                await window.gapi.client.init({
                  apiKey: GOOGLE_API_CONFIG.apiKey,
                  discoveryDocs: GOOGLE_API_CONFIG.discoveryDocs,
                });
                resolveGapi();
              } catch (error) {
                console.error('Error initializing GAPI client:', error);
                reject(error);
              }
            });
          });
          
          // Step 3: Load the Google Identity Services library
          if (!window.google?.accounts?.oauth2) {
            await this.loadScript('https://accounts.google.com/gsi/client');
          }
          
          // Step 4: Initialize the token client
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_API_CONFIG.clientId,
            scope: GOOGLE_API_CONFIG.scope,
            prompt: 'consent',  // Force consent screen to ensure refresh token
            callback: (tokenResponse) => {
              if (tokenResponse.error !== undefined) {
                console.error('Error during token response:', tokenResponse);
                reject(tokenResponse);
                return;
              }
              
              // Set the token for API requests
              window.gapi.client.setToken(tokenResponse);
              
              // Get user info and notify listeners
              this.fetchUserInfo()
                .then(() => {
                  this.notifySignInListeners(true);
                  resolve();
                })
                .catch(error => {
                  console.error('Error fetching user info:', error);
                  reject(error);
                });
            }
          });
          
          this.isInitialized = true;
          resolve();
        } catch (error) {
          console.error('Error initializing Google services:', error);
          reject(error);
        }
      };
      
      loadScripts();
    });
  }
  
  /**
   * Load a script asynchronously
   * @param {string} src - Script URL
   * @returns {Promise} Promise that resolves when the script is loaded
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = (error) => {
        console.error(`Error loading script ${src}:`, error);
        reject(error);
      };
      document.body.appendChild(script);
    });
  }
  
  /**
   * Fetch user information using the userinfo endpoint
   * @private
   * @returns {Promise} Promise that resolves with user info
   */
  async fetchUserInfo() {
    try {
      // Use the userinfo endpoint which requires less permissions
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      this.currentUser = {
        id: data.sub,
        name: data.name || 'Unknown',
        email: data.email || '',
        imageUrl: data.picture || ''
      };
      
      return this.currentUser;
    } catch (error) {
      console.error('Error fetching user info:', error);
      this.currentUser = null;
      throw error;
    }
  }

  /**
   * Notify all sign-in listeners of a state change
   * @private
   * @param {boolean} isSignedIn Whether the user is signed in
   */
  notifySignInListeners(isSignedIn) {
    this.signInListeners.forEach(listener => {
      try {
        listener(isSignedIn);
      } catch (error) {
        console.error('Error in sign-in listener:', error);
      }
    });
  }

  /**
   * Check if the user is signed in
   * @returns {boolean} True if the user is signed in
   */
  isSignedIn() {
    return !!this.currentUser;
  }

  /**
   * Get the current user's profile information
   * @returns {Object|null} User profile or null if not signed in
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Sign in the user
   * @returns {Promise} Promise that resolves when sign-in is complete
   */
  async signIn() {
    if (!this.isInitialized) await this.initialize();
    
    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.requestAccessToken();
        resolve(); // The actual sign-in happens in the callback of tokenClient
      } catch (error) {
        console.error('Error during sign in:', error);
        reject(error);
      }
    });
  }

  /**
   * Sign out the user
   * @returns {Promise} Promise that resolves when sign-out is complete
   */
  async signOut() {
    if (!this.isInitialized) return Promise.resolve();
    
    const token = window.gapi.client.getToken();
    if (token !== null) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        // Clear the token
        window.gapi.client.setToken('');
        // Reset user data
        this.currentUser = null;
        // Notify listeners
        this.notifySignInListeners(false);
      });
    }
    
    return Promise.resolve();
  }

  /**
   * Add a listener for sign-in state changes
   * @param {Function} listener Callback function that takes a boolean parameter
   * @returns {Function} Function to remove the listener
   */
  addSignInListener(listener) {
    this.signInListeners.push(listener);
    
    // Return a function to remove this listener
    return () => {
      this.signInListeners = this.signInListeners.filter(l => l !== listener);
    };
  }

  /**
   * Import events from Google Calendar
   * @param {Date} startDate Start date for events to import
   * @param {Date} endDate End date for events to import
   * @returns {Promise<Array>} Promise that resolves with an array of events
   */
  async importEvents(startDate = new Date(), endDate = null) {
    if (!this.isInitialized) await this.initialize();
    if (!this.isSignedIn()) throw new Error('User is not signed in');
    
    // Default to one month from now if no end date provided
    if (!endDate) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    try {
      // Load the Calendar API if not already loaded
      if (!window.gapi.client.calendar) {
        await window.gapi.client.load('calendar', 'v3');
      }
      
      // Get events from Google Calendar
      const response = await window.gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': startDate.toISOString(),
        'timeMax': endDate.toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'orderBy': 'startTime',
        'maxResults': 2500 // Maximum allowed by the API
      });

      // Process events into a format compatible with our app
      const events = response.result.items.map(event => {
        const allDay = !event.start.dateTime;
        
        return {
          id: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          location: event.location || '',
          start: allDay ? event.start.date : event.start.dateTime,
          end: allDay ? event.end.date : event.end.dateTime,
          allDay,
          color: '#d2b48c', // Default color, as Google doesn't provide color info in this format
          googleEventId: event.id, // Store the Google event ID for future reference
          type: 'google' // Changed from source to type to match our schema
        };
      });

      return events;
    } catch (error) {
      console.error('Error importing events from Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Export an event to Google Calendar
   * @param {Object} event Event to export
   * @returns {Promise<Object>} Promise that resolves with the created Google Calendar event
   */
  async exportEvent(event) {
    if (!this.isInitialized) await this.initialize();
    if (!this.isSignedIn()) throw new Error('User is not signed in');
    
    try {
      // Load the Calendar API if not already loaded
      if (!window.gapi.client.calendar) {
        await window.gapi.client.load('calendar', 'v3');
      }
      
      // Convert the event to Google Calendar format
      const googleEvent = {
        'summary': event.title,
        'location': event.location || '',
        'description': event.description || '',
        'start': event.allDay ? { 'date': event.start.split('T')[0] } : { 'dateTime': event.start },
        'end': event.allDay ? { 'date': event.end.split('T')[0] } : { 'dateTime': event.end },
        'reminders': {
          'useDefault': true
        }
      };
      
      // Create the event in Google Calendar
      const response = await window.gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': googleEvent
      });
      
      return response.result;
    } catch (error) {
      console.error('Error exporting event to Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Update an event in Google Calendar
   * @param {Object} event Event to update
   * @returns {Promise<Object>} Promise that resolves with the updated Google Calendar event
   */
  async updateEvent(event) {
    if (!this.isInitialized) await this.initialize();
    if (!this.isSignedIn()) throw new Error('User is not signed in');
    if (!event.googleEventId) throw new Error('Event does not have a Google Calendar ID');
    
    try {
      // Load the Calendar API if not already loaded
      if (!window.gapi.client.calendar) {
        await window.gapi.client.load('calendar', 'v3');
      }
      
      // Convert the event to Google Calendar format
      const googleEvent = {
        'summary': event.title,
        'location': event.location || '',
        'description': event.description || '',
        'start': event.allDay ? { 'date': event.start.split('T')[0] } : { 'dateTime': event.start },
        'end': event.allDay ? { 'date': event.end.split('T')[0] } : { 'dateTime': event.end },
        'reminders': {
          'useDefault': true
        }
      };
      
      // Update the event in Google Calendar
      const response = await window.gapi.client.calendar.events.update({
        'calendarId': 'primary',
        'eventId': event.googleEventId,
        'resource': googleEvent
      });
      
      return response.result;
    } catch (error) {
      console.error('Error updating event in Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Delete an event from Google Calendar
   * @param {Object} event Event to delete
   * @returns {Promise} Promise that resolves when the event is deleted
   */
  async deleteEvent(event) {
    if (!this.isInitialized) await this.initialize();
    if (!this.isSignedIn()) throw new Error('User is not signed in');
    if (!event.googleEventId) throw new Error('Event does not have a Google Calendar ID');
    
    try {
      // Load the Calendar API if not already loaded
      if (!window.gapi.client.calendar) {
        await window.gapi.client.load('calendar', 'v3');
      }
      
      // Delete the event from Google Calendar
      const response = await window.gapi.client.calendar.events.delete({
        'calendarId': 'primary',
        'eventId': event.googleEventId
      });
      
      return response.result;
    } catch (error) {
      console.error('Error deleting event from Google Calendar:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const googleCalendarService = new GoogleCalendarService();

export default googleCalendarService;
