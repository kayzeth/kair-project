import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import nudgerTestUtils from './services/nudgerTestUtils'; // [KAIR-15] Import Nudger test utilities

// [KAIR-15] Make test utilities available in browser console
if (process.env.NODE_ENV === 'development') {
  window.nudgerTestUtils = nudgerTestUtils;
  console.log('[KAIR-15] Nudger test utilities available in console. Try window.nudgerTestUtils.testNudger()');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
