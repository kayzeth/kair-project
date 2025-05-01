import React, { useState } from 'react';
import { LoginForm, SignupForm } from './AuthForms';
import Title from './Title';
import logo2 from '../assets/images/logo2.png';
import '../styles/Landing.css';
import '../styles/AuthForms.css';

const Landing = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="landing-container" data-testid="landing-container">
      <Title page="Welcome" />
      <div className="landing-content" data-testid="landing-content">
        <div className="landing-logo-container" data-testid="landing-logo-container">
          <img src={logo2} alt="Kairos Logo" className="landing-logo" data-testid="landing-logo" />
        </div>
        <h1 data-testid="landing-title">Welcome to Kairos</h1>
        <p className="tagline" data-testid="landing-tagline">Your intelligent academic calendar assistant</p>

        <div className="auth-section" data-testid="auth-section">
          <div className="auth-container" data-testid="auth-container">
            <h2 data-testid="auth-heading">{isLogin ? 'Log In' : 'Sign Up'}</h2>
            {isLogin ? <LoginForm /> : <SignupForm />}
            <div className="auth-toggle" data-testid="auth-toggle">
              {isLogin ? (
                <p data-testid="auth-toggle-text">
                  Don't have an account?{' '}
                  <button onClick={() => setIsLogin(false)} data-testid="signup-button">Sign up</button>
                </p>
              ) : (
                <p data-testid="auth-toggle-text">
                  Already have an account?{' '}
                  <button onClick={() => setIsLogin(true)} data-testid="login-button">Log in</button>
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
