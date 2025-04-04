import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faFileUpload, faUser } from '@fortawesome/free-solid-svg-icons';
import { LoginForm, SignupForm } from './AuthForms';
import '../styles/Landing.css';
import '../styles/AuthForms.css';

const Landing = () => {
  const [isLogin, setIsLogin] = useState(true);
  // const navigate = useNavigate();

  // const handleSubmit = (e) => {
  //   e.preventDefault();
  //   // For now, just navigate to calendar without authentication
  //   navigate('/calendar');
  // };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1>Welcome to Kairos</h1>
        <p className="tagline">Your intelligent academic calendar assistant</p>

        <div className="auth-section">
          <div className="auth-container">
            <h2>{isLogin ? 'Log In' : 'Sign Up'}</h2>
            {isLogin ? <LoginForm /> : <SignupForm />}
            <div className="auth-toggle">
              {isLogin ? (
                <p>
                  Don't have an account?{' '}
                  <button onClick={() => setIsLogin(false)}>Sign up</button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button onClick={() => setIsLogin(true)}>Log in</button>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="features-section">
          <h2>Features</h2>
          <div className="feature-cards">
            <div className="feature-card">
              <FontAwesomeIcon icon={faCalendarAlt} />
              <h3>Smart Calendar</h3>
              <p>Intelligent scheduling and event management for your academic life</p>
            </div>
            <div className="feature-card">
              <FontAwesomeIcon icon={faFileUpload} />
              <h3>Syllabus Parser</h3>
              <p>Automatically extract important dates and deadlines from your syllabi</p>
            </div>
            <div className="feature-card">
              <FontAwesomeIcon icon={faUser} />
              <h3>Personal Assistant</h3>
              <p>Get smart suggestions for study sessions and event preparation</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
