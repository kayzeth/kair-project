import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKey } from '@fortawesome/free-solid-svg-icons';
import { getApiKey, saveApiKey, clearApiKey, initializeGenAISync } from '../services/geminiService';

/**
 * Component for entering and managing the Gemini API key
 * Displays as a section below the calendar
 */
const ApiKeyInput = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [setError] = useState('');
  const [setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [persistence] = useState('session');
  
  // Check if API key exists on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const savedApiKey = await getApiKey();
        if (savedApiKey) {
          setApiKey(savedApiKey);
          setMessage('API key loaded from server');
          setTimeout(() => setMessage(''), 3000);
        }
      } catch (error) {
        console.error('Error checking API key:', error);
      }
    };
    
    checkApiKey();
  }, []);

  // const handleSubmit = (e) => {
  //   e.preventDefault();
    
  //   if (!apiKey.trim()) {
  //     setError('Please enter an API key');
  //     return;
  //   }
    
  //   // Save API key with selected persistence
  //   const saveResult = saveApiKey(apiKey, persistence);
    
  //   if (!saveResult) {
  //     setError('Failed to save API key');
  //     return;
  //   }
    
  //   // Reinitialize the Gemini API with the new key
  //   const genAI = initializeGenAISync();
    
  //   if (!genAI) {
  //     setError('API key saved but failed to initialize Gemini API');
  //     // Still pass the key to parent component
  //     onApiKeySubmit(apiKey);
  //     return;
  //   }
    
  //   // Pass the API key to the parent component
  //   onApiKeySubmit(apiKey);
    
  //   // Collapse the expanded info
  //   setIsExpanded(false);
    
  //   // Show success message
  //   setMessage('API key is now managed by the server for all users');
  //   setTimeout(() => setMessage(''), 5000);
  // };

  // const handleClear = () => {
  //   clearApiKey();
  //   setApiKey('');
  //   setMessage('API key cleared from storage');
  //   setTimeout(() => setMessage(''), 3000);
    
  //   // Notify parent component
  //   onApiKeySubmit(null);
  // };

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
            <strong>Note:</strong> Gemini API key is now managed by the server for all users.
            You no longer need to provide your own API key.
          </p>
          
          <div className="api-key-info">
            <p>
              The application now uses a centralized API key managed by the server.
              This provides a better user experience as you no longer need to create and manage your own API key.
            </p>
            <p>
              All study suggestions and AI features will work automatically without any additional setup.
            </p>
          </div>
        </div>
      ) : (
        <div className="api-key-status">
          <span className="api-key-set">Gemini API key is managed by the server</span>
        </div>
      )}
    </div>
  );
};

export default ApiKeyInput;
