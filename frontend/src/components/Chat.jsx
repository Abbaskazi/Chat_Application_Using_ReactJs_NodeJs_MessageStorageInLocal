import { useState, useEffect, useRef } from 'react';
import { io } from "socket.io-client";
import { showNotification } from '../utils/notificationService';

import './Chat.css';

const Chat = ({ username, onLogout }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Track pending messages
    let pendingMessagesQueue = [];
    let isReceivingPendingBatch = false;
    let pendingMessageTimeout = null;
    let expectedPendingCount = 0;

    // Initialize socket connection with reconnection enabled
    const newSocket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      // Keep connection alive even when tab is in background
      forceNew: false,
      timeout: 20000,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    // Load messages from localStorage
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    // Function to process pending messages queue
    const processPendingQueue = () => {
      if (pendingMessagesQueue.length > 0) {
        console.log(`Showing notifications for ${pendingMessagesQueue.length} pending messages`);
        // Only show notifications if tab is not focused (user might have just opened it)
        // If tab is focused, user is already seeing the messages, no need for notification
        if (document.hidden || !document.hasFocus()) {
          pendingMessagesQueue.forEach((msg, index) => {
            setTimeout(() => {
              showNotification(msg, true); // Force show for pending messages when tab not focused
            }, index * 200); // Small stagger to avoid notification spam
          });
        }
        pendingMessagesQueue = [];
      }
      isReceivingPendingBatch = false;
      expectedPendingCount = 0;
    };

    // Listen for pending messages batch start
    newSocket.on('pending-messages-start', ({ count }) => {
      console.log(`📬 Receiving ${count} pending messages (user was offline)`);
      console.log(`✅ ${username} came back ONLINE and has ${count} pending messages`);
      isReceivingPendingBatch = true;
      expectedPendingCount = count;
      pendingMessagesQueue = [];
      
      // Clear any existing timeout
      if (pendingMessageTimeout) {
        clearTimeout(pendingMessageTimeout);
      }
      
      // Set timeout to process queue after all messages should have arrived
      pendingMessageTimeout = setTimeout(() => {
        processPendingQueue();
      }, count * 100 + 500); // Wait for all messages + buffer
    });

    // Emit user login when connected
    newSocket.on('connect', () => {
      console.log('🔌 Socket connected');
      console.log(`✅ ${username} is now ONLINE`);
      newSocket.emit('user-login', { username });
      
      // Ensure push subscription is active
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        import('../utils/notificationService').then(({ subscribeToPush }) => {
          subscribeToPush(username).catch(err => {
            console.log('Push subscription update failed:', err);
          });
        });
      }
    });

    // Handle disconnection
    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      console.log(`❌ ${username} is now OFFLINE`);
    });

    // Handle reconnection
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      console.log(`✅ ${username} is back ONLINE`);
    });

    // Handle connection errors
    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      console.log(`❌ ${username} connection failed`);
    });

    // Listen for new messages
    newSocket.on('receive-message', (messageData) => {
      // Only process messages from another user
      if (messageData.username !== username) {
        // Send delivery confirmation
        if (messageData.id) {
          newSocket.emit('message-delivered', { messageId: messageData.id });
        }

        // If it's marked as pending, queue it for batch notification
        if (messageData.isPending && isReceivingPendingBatch) {
          pendingMessagesQueue.push(messageData);
          
          // If we've received all expected messages, process immediately
          if (pendingMessagesQueue.length >= expectedPendingCount) {
            if (pendingMessageTimeout) {
              clearTimeout(pendingMessageTimeout);
            }
            processPendingQueue();
          }
        } else {
          // Real-time message - user is online, don't show notification
          // Notifications should only come from backend push when user is offline
          // When user is online, they see messages in real-time in the chat
          // No need for notifications
          console.log(`🔕 Notification blocked: ${username} is ONLINE - message received in real-time`);
        }
      }

      setMessages((prev) => {
        // Remove isPending flag before storing
        const { isPending, ...cleanMessage } = messageData;
        
        // Check if message already exists (avoid duplicates)
        const exists = prev.some(
          msg => (msg.id && cleanMessage.id && msg.id === cleanMessage.id) ||
                 (msg.timestamp === cleanMessage.timestamp && 
                 msg.username === cleanMessage.username &&
                 msg.message === cleanMessage.message)
        );
        if (exists) return prev;
        
        const newMessages = [...prev, cleanMessage];
        // Save to localStorage
        localStorage.setItem('chatMessages', JSON.stringify(newMessages));
        return newMessages;
      });
    });

    // Listen for message status updates (delivery/read)
    newSocket.on('message-status-update', ({ messageId, status }) => {
      setMessages((prev) => {
        return prev.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, status };
          }
          return msg;
        });
      });
    });

    // Keep connection alive even when tab is in background
    const keepAliveInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds

    // Listen for typing indicators
    newSocket.on('user-typing', (userData) => {
      if (userData.username !== username) {
        setTypingUser(userData.username);
      }
    });

    newSocket.on('user-stopped-typing', (userData) => {
      if (userData.username !== username) {
        setTypingUser(null);
      }
    });

    // Cleanup on unmount
    return () => {
      clearInterval(keepAliveInterval);
      if (pendingMessageTimeout) {
        clearTimeout(pendingMessageTimeout);
      }
      newSocket.disconnect();
      // Clear localStorage on component unmount (refresh)
      localStorage.removeItem('chatMessages');
    };
  }, [username]);

  // Handle visibility change to show notifications when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && messages.length > 0) {
        // Check if there are new messages that arrived while tab was hidden
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.username !== username) {
          // Notification would have been shown when message arrived
          // This is just for handling edge cases
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [messages, username]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Mark messages as read when they're visible
  useEffect(() => {
    if (socket && messages.length > 0) {
      // Find unread messages from other users
      const unreadMessages = messages.filter(
        msg => msg.username !== username && 
               msg.id && 
               (!msg.status || msg.status !== 'read')
      );

      // Mark as read after a short delay (user has seen them)
      if (unreadMessages.length > 0) {
        const readTimeout = setTimeout(() => {
          unreadMessages.forEach(msg => {
            if (msg.id && socket) {
              socket.emit('message-read', { messageId: msg.id });
            }
          });
        }, 1000);

        return () => clearTimeout(readTimeout);
      }
    }
  }, [messages, username, socket]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket) return;

    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageData = {
      id: messageId,
      username,
      message: inputMessage.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    // Add message to local state
    setMessages((prev) => {
      const newMessages = [...prev, messageData];
      localStorage.setItem('chatMessages', JSON.stringify(newMessages));
      return newMessages;
    });

    // Emit message to server
    socket.emit('send-message', messageData);

    // Stop typing indicator
    socket.emit('typing-stop', { username });
    setIsTyping(false);
    setInputMessage('');

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    if (!socket) return;

    // Emit typing start
    if (!isTyping) {
      socket.emit('typing-start', { username });
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', { username });
      setIsTyping(false);
    }, 1000);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Render message status ticks (WhatsApp style)
  const renderMessageStatus = (msg) => {
    if (msg.username !== username) return null; // Only show ticks for sent messages

    const status = msg.status || 'sent';
    let tickClass = 'message-tick';
    
    if (status === 'read') {
      tickClass += ' message-tick-read';
    } else if (status === 'delivered') {
      tickClass += ' message-tick-delivered';
    }

    return (
      <span className={tickClass}>
        {status === 'read' || status === 'delivered' ? (
          // Double tick (delivered/read)
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.5 5.5L4 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.5 5.5L10 9L15.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          // Single tick (sent)
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.5 5.5L4 9L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-info">
          <h2>Chat App</h2>
          <p className="chat-username">Logged in as: {username}</p>
        </div>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || index}
              className={`message ${msg.username === username ? 'message-sent' : 'message-received'}`}
            >
              <div className="message-content">
                <div className="message-header">
                  <span className="message-username">{msg.username}</span>
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                    {renderMessageStatus(msg)}
                  </div>
                </div>
                <p className="message-text">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        {typingUser && (
          <div className="typing-indicator">
            <span>{typingUser} is typing</span>
            <span className="typing-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button type="submit" className="send-button" disabled={!inputMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;


