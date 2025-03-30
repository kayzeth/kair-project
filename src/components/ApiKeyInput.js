import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey, faCheck, faEye, faEyeSlash, faTrash } from '@fortawesome/free-solid-svg-icons';
import { getApiKey, saveApiKey, clearApiKey, initializeGenAI } from '../services/geminiService';

/**
 * Component for entering and managing the Gemini API key
 * Displays as a section below the calendar
 */
const ApiKeyInput = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [persistence, setPersistence] = useState('session');
  
  // Check if API key exists in storage on component mount
  useEffect(() => {
    const savedApiKey = getApiKey();
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setMessage('API key loaded from storage');
      setTimeout(() => setMessage(''), 3000);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    
    // Save API key with selected persistence
    const saveResult = saveApiKey(apiKey, persistence);
    
    if (!saveResult) {
      setError('Failed to save API key');
      return;
    }
    
    // Reinitialize the Gemini API with the new key
    const genAI = initializeGenAI();
    
    if (!genAI) {
      setError('API key saved but failed to initialize Gemini API');
      // Still pass the key to parent component
      onApiKeySubmit(apiKey);
      return;
    }
    
    // Pass the API key to the parent component
    onApiKeySubmit(apiKey);
    
    // Collapse the expanded info
    setIsExpanded(false);
    
    // Show success message
    setMessage(`API key saved ${persistence === 'none' ? 'for this session only (not stored)' : 
               persistence === 'session' ? 'until browser is closed' : 
               'permanently in browser'}`);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleClear = () => {
    clearApiKey();
    setApiKey('');
    setMessage('API key cleared from storage');
    setTimeout(() => setMessage(''), 3000);
    
    // Notify parent component
    onApiKeySubmit(null);
  };

  return (
    <div className="api-key-section">
      <div className="api-key-section-header">
        <h3>
          <FontAwesomeIcon icon={faKey} /> Gemini API Key
        </h3>
        <button 
          type="button" 
          className="toggle-button"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Hide Details" : "Show Details"}
        </button>
      </div>
      
      {isExpanded ? (
        <div className="api-key-section-content">
          <p className="api-key-description">
            Enter your Gemini API key to enable advanced study suggestions.
            Choose how you want to store your key for security.
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="api-key-input-group">
              <input
                type={showPassword ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                placeholder="Enter your Gemini API key"
                className={error ? "error" : ""}
              />
              <button 
                type="button" 
                className="toggle-visibility"
                onClick={() => setShowPassword(!showPassword)}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
              <button type="submit" className="save-button">
                <FontAwesomeIcon icon={faCheck} /> Save
              </button>
              {apiKey && (
                <button 
                  type="button" 
                  className="clear-button"
                  onClick={handleClear}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              )}
            </div>
            
            <div className="storage-options">
              <label>
                <input
                  type="radio"
                  name="persistence"
                  value="none"
                  checked={persistence === 'none'}
                  onChange={() => setPersistence('none')}
                />
                Don't store (most secure, must re-enter each time)
              </label>
              <label>
                <input
                  type="radio"
                  name="persistence"
                  value="session"
                  checked={persistence === 'session'}
                  onChange={() => setPersistence('session')}
                />
                Session only (cleared when browser closes)
              </label>
              <label>
                <input
                  type="radio"
                  name="persistence"
                  value="local"
                  checked={persistence === 'local'}
                  onChange={() => setPersistence('local')}
                />
                Remember permanently (convenient but less secure)
              </label>
            </div>
            
            {error && (
              <div className="api-key-message error">
                {error}
              </div>
            )}
            
            {message && (
              <div className="api-key-message success">
                {message}
              </div>
            )}
            
            <div className="api-key-info">
              <p>
                <strong>How to get an API key:</strong> Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>, 
                create or sign in to your Google account, and create a new API key.
              </p>
              <p>
                <strong>Security note:</strong> Your API key is only stored in your browser and is never sent to our servers.
                For maximum security, use the "Don't store" option and re-enter your key when needed.
              </p>
            </div>
          </form>
        </div>
      ) : (
        <div className="api-key-status">
          {apiKey ? (
            <span className="api-key-set">API key is set {message && `(${message})`}</span>
          ) : (
            <span className="api-key-not-set">No API key set - click "Show Details" to add one</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ApiKeyInput;
