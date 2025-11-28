import { useState } from 'react';
import './Auth.css';

const Auth = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setError('');
    onLogin(username.trim());
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Chat App</h1>
        <p className="auth-subtitle">Enter your username to start chatting</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="auth-input"
            autoFocus
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-button">
            Start Chatting
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;


