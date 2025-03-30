const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api/events/'  // In production, use relative path
  : 'http://localhost:3001/api/events/';  // In development, use full URL

const eventService = {
  async saveEvents(events, userId) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          events,
          userId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving events to MongoDB:', error);
      throw error;
    }
  },

  async getEvents(userId) {
    try {
      const response = await fetch(`${API_URL}${userId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching events from MongoDB:', error);
      throw error;
    }
  }
};

export default eventService;
