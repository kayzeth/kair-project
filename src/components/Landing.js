import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faFileUpload, faUser } from '@fortawesome/free-solid-svg-icons';
import { LoginForm, SignupForm } from './AuthForms';
import logo2 from '../assets/images/logo2.png';
import '../styles/Landing.css';
import '../styles/AuthForms.css';

const Landing = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-logo-container">
          <img src={logo2} alt="Kairos Logo" className="landing-logo" />
        </div>
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

      </div>
    </div>
  );
};

export default Landing;
