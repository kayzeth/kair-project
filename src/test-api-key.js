// Test script to verify API key handling
import { getApiKey, saveApiKey, clearApiKey, initializeGenAI } from './services/geminiService';

// Clear any existing keys
console.log('Clearing existing API keys...');
clearApiKey();
console.log('API key cleared');

// Test saving with different persistence options
const testKey = 'test-api-key-123456789';

// Test session storage
console.log('\nTesting session storage:');
saveApiKey(testKey, 'session');
console.log('API key saved to session storage');
console.log('Retrieved key:', getApiKey());
console.log('Session storage value:', sessionStorage.getItem('geminiApiKey'));
console.log('Local storage value:', localStorage.getItem('geminiApiKey'));

// Clear and test local storage
console.log('\nTesting local storage:');
clearApiKey();
saveApiKey(testKey, 'local');
console.log('API key saved to local storage');
console.log('Retrieved key:', getApiKey());
console.log('Session storage value:', sessionStorage.getItem('geminiApiKey'));
console.log('Local storage value:', localStorage.getItem('geminiApiKey'));

// Clear and test no storage
console.log('\nTesting no storage:');
clearApiKey();
saveApiKey(testKey, 'none');
console.log('API key saved with no persistence');
console.log('Retrieved key:', getApiKey());
console.log('Session storage value:', sessionStorage.getItem('geminiApiKey'));
console.log('Local storage value:', localStorage.getItem('geminiApiKey'));

// Test initializing Gemini API
console.log('\nTesting Gemini API initialization:');
const genAI = initializeGenAI();
console.log('Gemini API initialized:', genAI ? 'Success' : 'Failed');

// Clean up
console.log('\nCleaning up...');
clearApiKey();
console.log('API key cleared');
