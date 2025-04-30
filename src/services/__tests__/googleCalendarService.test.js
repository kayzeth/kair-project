// __tests__/googleCalendarService.test.js
import googleCalendarService from '../googleCalendarService';
import { GOOGLE_API_CONFIG, isConfigured } from '../../config/googleCalendarConfig';

jest.mock('../../config/googleCalendarConfig', () => ({
  GOOGLE_API_CONFIG: {
    apiKey: 'test-api-key',
    discoveryDocs: ['doc1'],
    clientId: 'test-client-id',
    scope: 'test-scope',
  },
  isConfigured: jest.fn(),
}));

describe('GoogleCalendarService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // reset singleton internal state
    googleCalendarService.isInitialized = false;
    googleCalendarService.tokenClient = null;
    googleCalendarService.signInListeners = [];
    googleCalendarService.currentUser = null;
    // clean up DOM
    document.body.innerHTML = '';
    // delete any global API objects
    delete window.gapi;
    delete window.google;
    global.fetch = jest.fn();
  });

  describe('initialize()', () => {
    test('immediately resolves if already initialized', async () => {
      googleCalendarService.isInitialized = true;
      await expect(googleCalendarService.initialize()).resolves.toBeUndefined();
    });

    test('rejects if API is not configured', async () => {
      isConfigured.mockReturnValue(false);
      await expect(googleCalendarService.initialize())
        .rejects
        .toThrow('Google Calendar API credentials are not configured');
    });

    test('loads scripts, inits gapi and tokenClient, and sets isInitialized', async () => {
      isConfigured.mockReturnValue(true);

      // spy on loadScript so it never actually touches the network
      jest.spyOn(googleCalendarService, 'loadScript').mockResolvedValue();

      // mock gapi
      window.gapi = {
        load: jest.fn((lib, cb) => cb()),
        client: {
          init: jest.fn().mockResolvedValue({}),
        }
      };
      // after init, client.init should be called with our config
      // mock google.identity
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: jest.fn().mockReturnValue({
              requestAccessToken: jest.fn()
            })
          }
        }
      };

      await expect(googleCalendarService.initialize()).resolves.toBeUndefined();
      expect(googleCalendarService.isInitialized).toBe(true);
      expect(googleCalendarService.tokenClient).toBeDefined();
      expect(window.gapi.load).toHaveBeenCalledWith('client', expect.any(Function));
      expect(window.gapi.client.init).toHaveBeenCalledWith({
        apiKey: GOOGLE_API_CONFIG.apiKey,
        discoveryDocs: GOOGLE_API_CONFIG.discoveryDocs
      });
      expect(window.google.accounts.oauth2.initTokenClient).toHaveBeenCalledWith(expect.objectContaining({
        client_id: GOOGLE_API_CONFIG.clientId,
        scope: GOOGLE_API_CONFIG.scope,
        prompt: 'consent',
        callback: expect.any(Function)
      }));
    });

    test('rejects when gapi.client.init throws', async () => {
      isConfigured.mockReturnValue(true);
      jest.spyOn(googleCalendarService, 'loadScript').mockResolvedValue();
      window.gapi = {
        load: jest.fn((lib, cb) => cb()),
        client: { init: jest.fn().mockRejectedValue(new Error('init failed')) }
      };
      window.google = { accounts: { oauth2: { initTokenClient: jest.fn() } } };

      await expect(googleCalendarService.initialize()).rejects.toThrow('init failed');
    });
  });

  describe('fetchUserInfo()', () => {
    beforeEach(() => {
      // ensure there's a token
      window.gapi = {
        client: { getToken: jest.fn(() => ({ access_token: 'tok' })) }
      };
    });

    test('fetches user info and sets currentUser on ok response', async () => {
      const fakeData = { sub: '123', name: 'Alice', email: 'a@b.com', picture: 'img.png' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeData)
      });
      const user = await googleCalendarService.fetchUserInfo();
      expect(user).toEqual({
        id: '123',
        name: 'Alice',
        email: 'a@b.com',
        imageUrl: 'img.png'
      });
      expect(googleCalendarService.currentUser).toEqual(user);
    });

    test('throws on non-ok response', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Err' });
      await expect(googleCalendarService.fetchUserInfo())
        .rejects
        .toThrow('Failed to fetch user info: 500 Err');
      expect(googleCalendarService.currentUser).toBeNull();
    });

    test('throws on fetch error', async () => {
      global.fetch.mockRejectedValue(new Error('network'));
      await expect(googleCalendarService.fetchUserInfo())
        .rejects
        .toThrow('network');
      expect(googleCalendarService.currentUser).toBeNull();
    });
  });

  describe('notifySignInListeners()', () => {
    test('calls all listeners and catches errors', () => {
      const good = jest.fn();
      const bad = jest.fn(() => { throw new Error('oops'); });
      console.error = jest.fn();
      googleCalendarService.signInListeners = [good, bad];
      googleCalendarService.notifySignInListeners(true);
      expect(good).toHaveBeenCalledWith(true);
      expect(bad).toHaveBeenCalledWith(true);
      expect(console.error).toHaveBeenCalledWith('Error in sign-in listener:', expect.any(Error));
    });
  });

  describe('isSignedIn() and getCurrentUser()', () => {
    test('reports signed-in state based on currentUser', () => {
      expect(googleCalendarService.isSignedIn()).toBe(false);
      googleCalendarService.currentUser = { id: 'x' };
      expect(googleCalendarService.isSignedIn()).toBe(true);
      expect(googleCalendarService.getCurrentUser()).toEqual({ id: 'x' });
    });
  });

  describe('signIn()', () => {
    test('initializes then requests access token', async () => {
      googleCalendarService.isInitialized = false;
      googleCalendarService.initialize = jest.fn().mockResolvedValue();
      googleCalendarService.tokenClient = { requestAccessToken: jest.fn() };

      await expect(googleCalendarService.signIn()).resolves.toBeUndefined();
      expect(googleCalendarService.initialize).toHaveBeenCalled();
      expect(googleCalendarService.tokenClient.requestAccessToken).toHaveBeenCalled();
    });

    test('rejects on request error', async () => {
      googleCalendarService.isInitialized = true;
      googleCalendarService.tokenClient = { requestAccessToken: () => { throw new Error('bad'); } };
      await expect(googleCalendarService.signIn()).rejects.toThrow('bad');
    });
  });

  describe('signOut()', () => {
    beforeEach(() => {
      googleCalendarService.isInitialized = true;
      window.gapi = { client: { getToken: jest.fn(() => ({ access_token: 'tok' })), setToken: jest.fn() } };
      window.google = {
        accounts: { oauth2: { revoke: jest.fn((t, cb) => cb()) } }
      };
      googleCalendarService.currentUser = { id: 'u' };
      console.log = jest.fn();
    });

    test('revokes token, clears state, notifies listeners', async () => {
      const listener = jest.fn();
      googleCalendarService.addSignInListener(listener);

      await googleCalendarService.signOut();
      expect(window.google.accounts.oauth2.revoke).toHaveBeenCalledWith('tok', expect.any(Function));
      expect(window.gapi.client.setToken).toHaveBeenCalledWith('');
      expect(googleCalendarService.currentUser).toBeNull();
      expect(listener).toHaveBeenCalledWith(false);
    });

    test('resolves immediately if not initialized', async () => {
      googleCalendarService.isInitialized = false;
      await expect(googleCalendarService.signOut()).resolves.toBeUndefined();
    });
  });

  describe('addSignInListener()', () => {
    test('adds and removes a listener', () => {
      const fn = () => {};
      const remove = googleCalendarService.addSignInListener(fn);
      expect(googleCalendarService.signInListeners).toContain(fn);
      remove();
      expect(googleCalendarService.signInListeners).not.toContain(fn);
    });
  });

  describe('getCalendarList()', () => {
    beforeEach(() => {
      googleCalendarService.isInitialized = true;
      googleCalendarService.currentUser = { id: 'u' };
      window.gapi = {
        client: {
          load: jest.fn().mockResolvedValue(),
          calendar: {
            calendarList: { list: jest.fn().mockResolvedValue({ result: { items: [
              { id:'1', primary:true, accessRole:'owner' },
              { id:'2', primary:false, accessRole:'reader' },
            ] } })}
          }
        }
      };
    });

    test('returns only owned calendars when ownedOnly=true', async () => {
      // Save the original calendar object and load method
      const originalCalendar = window.gapi.client.calendar;
      const originalLoad = window.gapi.client.load;
      
      try {
        // Set calendar to undefined to force the load call
        window.gapi.client.calendar = undefined;
        
        // Mock the load method to set up calendar after it's called
        window.gapi.client.load = jest.fn().mockImplementation((api, version) => {
          expect(api).toBe('calendar');
          expect(version).toBe('v3');
          
          // When load is called, set up the calendar object with calendarList.list
          window.gapi.client.calendar = {
            calendarList: {
              list: jest.fn().mockResolvedValue({
                result: {
                  items: [
                    { id: '1', primary: true, summary: 'Primary Calendar' },
                    { id: '2', accessRole: 'reader', summary: 'Shared Calendar' }
                  ]
                }
              })
            }
          };
          return Promise.resolve();
        });
        
        // Call the method under test
        const list = await googleCalendarService.getCalendarList(true);
        
        // Verify the load method was called
        expect(window.gapi.client.load).toHaveBeenCalledWith('calendar', 'v3');
        expect(list).toHaveLength(1);
        expect(list[0].id).toBe('1');
      } finally {
        // Restore the original objects
        window.gapi.client.calendar = originalCalendar;
        window.gapi.client.load = originalLoad;
      }
    });

    test('returns all calendars when ownedOnly=false', async () => {
      const list = await googleCalendarService.getCalendarList(false);
      expect(list).toHaveLength(2);
    });

    test('throws if not signed in', async () => {
      googleCalendarService.currentUser = null;
      await expect(googleCalendarService.getCalendarList()).rejects.toThrow('User is not signed in');
    });
  });

  describe('importEvents()', () => {
    beforeEach(() => {
      googleCalendarService.isInitialized = true;
      googleCalendarService.currentUser = { id: 'u' };
      // stub getCalendarList
      jest.spyOn(googleCalendarService, 'getCalendarList').mockResolvedValue([
        { id:'cal1', summary:'Cal 1', primary:true },
        { id:'cal2', summary:'Cal 2', primary:false },
      ]);
      window.gapi = {
        client: {
          load: jest.fn().mockResolvedValue(),
          calendar: {
            events: {
              list: jest.fn()
                // 1st call: returns items + nextSyncToken
                .mockResolvedValueOnce({
                  result: {
                    items: [{ id:'e1', start:{dateTime:'2020-01-01T00:00:00'}, end:{dateTime:'2020-01-01T01:00:00'}, status:'confirmed', updated:'u' }],
                    nextSyncToken: 'tok'
                  }
                })
                // 2nd call: simulate 410 Gone
                .mockRejectedValueOnce({ status: 410 })
            }
          }
        }
      };
    });

    test('imports events, handles syncToken expiration', async () => {
      const { events, nextSyncToken } = await googleCalendarService.importEvents(
        new Date('2020-01-01'), new Date('2020-02-01'), null
      );
      expect(events).toHaveLength(1);
      // unique ID prefix
      expect(events[0].id).toContain('cal1_e1');
      expect(nextSyncToken).toBe('tok');
    });

    test('throws if not signed in', async () => {
      googleCalendarService.currentUser = null;
      await expect(googleCalendarService.importEvents()).rejects.toThrow('User is not signed in');
    });
  });

  describe('exportEvent(), updateEvent(), deleteEvent()', () => {
    beforeEach(() => {
      googleCalendarService.isInitialized = true;
      googleCalendarService.currentUser = { id: 'u' };
      window.gapi = {
        client: {
          load: jest.fn().mockResolvedValue(),
          calendar: {
            events: {
              insert: jest.fn().mockResolvedValue({ result: { id: 'new' } }),
              update: jest.fn().mockResolvedValue({ result: { id: 'upd' } }),
              delete: jest.fn().mockResolvedValue({ result: {} })
            }
          }
        }
      };
    });

    test('exportEvent creates event', async () => {
      // Save the original implementation of load
      const originalLoad = window.gapi.client.load;
      
      // Make sure calendar is undefined to force the load call
      window.gapi.client.calendar = undefined;
      
      // Mock the load method to set up calendar after it's called
      window.gapi.client.load = jest.fn().mockImplementation((api, version) => {
        // When load is called, set up the calendar object with events.insert
        window.gapi.client.calendar = {
          events: {
            insert: jest.fn().mockResolvedValue({
              result: { id: 'new' }
            })
          }
        };
        return Promise.resolve();
      });
      
      const ev = { title:'T', start:'2020-01-01T00:00:00', end:'2020-01-01T01:00:00', allDay:false };
      const res = await googleCalendarService.exportEvent(ev);
      
      expect(window.gapi.client.load).toHaveBeenCalled();
      expect(res.id).toBe('new');
      
      // Restore the original load method
      window.gapi.client.load = originalLoad;
    });

    test('updateEvent throws when missing googleEventId', async () => {
      await expect(googleCalendarService.updateEvent({})).rejects.toThrow('Event does not have a Google Calendar ID');
    });

    test('updateEvent succeeds with googleEventId', async () => {
      const ev = { googleEventId:'e', title:'T', start:'2020-01-01', end:'2020-01-02', allDay:true };
      const res = await googleCalendarService.updateEvent(ev);
      expect(res.id).toBe('upd');
    });

    test('deleteEvent throws when missing googleEventId', async () => {
      await expect(googleCalendarService.deleteEvent({})).rejects.toThrow('Event does not have a Google Calendar ID');
    });

    test('deleteEvent succeeds with googleEventId', async () => {
      const ev = { googleEventId: 'e' };
      await expect(googleCalendarService.deleteEvent(ev)).resolves.toEqual({});
    });
  });
});
