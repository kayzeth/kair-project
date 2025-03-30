const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api/events/'  // In production, use relative path
  : 'http://localhost:3001/api/events/';  // In development, use full URL

const eventService = {
  async saveEvents(events, userId) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify(events)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving events to MongoDB:', error);
      throw error;
    }
  }
};

export default eventService;
