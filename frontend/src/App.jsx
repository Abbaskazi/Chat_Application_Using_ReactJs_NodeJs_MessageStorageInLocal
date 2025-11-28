import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { initNotificationService } from './utils/notificationService';
import './App.css';

function App() {
  const [username, setUsername] = useState(null);

  // Initialize notification service when username is available
  useEffect(() => {
    if (username) {
      initNotificationService(username);
    }
  }, [username]);

  // Check for saved username on component mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleLogin = (user) => {
    setUsername(user);
    // Save username to localStorage to persist login
    localStorage.setItem('chatUsername', user);
  };

  const handleLogout = () => {
    setUsername(null);
    // Clear username and chat messages from localStorage on logout
    localStorage.removeItem('chatUsername');
    localStorage.removeItem('chatMessages');
  };

  return (
    <div className="app">
      {username ? (
        <Chat username={username} onLogout={handleLogout} />
      ) : (
        <Auth onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
