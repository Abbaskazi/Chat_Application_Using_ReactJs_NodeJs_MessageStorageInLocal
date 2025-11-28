import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import webpush from "web-push";

const app = express();
const server = http.createServer(app);

// VAPID keys for web push
// Generate keys using: node generate-vapid-keys.js
// Then set them as environment variables or update below
const PUBLIC_VAPID_KEY = process.env.PUBLIC_VAPID_KEY || "BL_XWSSQiUYdUI_f1O1gPTBxeR4NLVn0A7SalqSpzJsE-WQH228NwFdTI1nZ4pcv782lCXKBd34aqUXqKc_DLzI";
const PRIVATE_VAPID_KEY = process.env.PRIVATE_VAPID_KEY || "QUyfMks605kW1NTB9K9zhDNXg5G5SQS5JdKrrthhXQo";

if (PUBLIC_VAPID_KEY === "YOUR_PUBLIC_VAPID_KEY_HERE" || PRIVATE_VAPID_KEY === "YOUR_PRIVATE_VAPID_KEY_HERE") {
  console.warn('⚠️  WARNING: VAPID keys not set! Web push notifications will not work.');
  console.warn('   Run: node generate-vapid-keys.js to generate keys');
}

// Configure web push
webpush.setVapidDetails(
  "mailto:your@email.com",
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite default port
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Endpoint to get public VAPID key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: PUBLIC_VAPID_KEY });
});

// Endpoint to save push subscription
app.post('/api/push-subscription', (req, res) => {
  const { username, subscription } = req.body;
  if (username && subscription) {
    pushSubscriptions.set(username, subscription);
    console.log(`Push subscription saved for ${username}`);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Username and subscription required' });
  }
});

// Function to send push notification
const sendPushNotification = async (username, messageData) => {
  const subscription = pushSubscriptions.get(username);
  if (subscription) {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          username: messageData.username,
          message: messageData.message,
          url: "/"
        })
      );
      console.log(`Push notification sent to ${username}`);
      return true;
    } catch (error) {
      console.error(`Error sending push notification to ${username}:`, error);
      // Remove invalid subscription
      if (error.statusCode === 410 || error.statusCode === 404) {
        pushSubscriptions.delete(username);
      }
      return false;
    }
  }
  return false;
};

// Store active users and their typing status
const users = new Map(); // socket.id -> userData
const usernameToSocket = new Map(); // username -> socket.id
const typingUsers = new Set();
// Store messages for offline users: recipientUsername -> array of messages
const offlineMessages = new Map();
// Track all usernames that have been in the system
const allUsernames = new Set();
// Track message delivery and read status: messageId -> { delivered: boolean, read: boolean }
const messageStatus = new Map();
// Store push subscriptions: username -> subscription object
const pushSubscriptions = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New socket connection:', socket.id);

  // Handle user login
  socket.on('user-login', (userData) => {
    users.set(socket.id, userData);
    usernameToSocket.set(userData.username, socket.id);
    allUsernames.add(userData.username);
    socket.broadcast.emit('user-joined', userData);
    console.log(`✅ ${userData.username} is now ONLINE`);
    console.log(`📊 Total online users: ${usernameToSocket.size}`);
    
    // If user has push subscription, it should be sent via separate API call

    // Collect all pending messages for this user
    const allPendingMessages = [];
    
    // Check if there are pending messages for this user
    if (offlineMessages.has(userData.username)) {
      const pendingMessages = offlineMessages.get(userData.username);
      allPendingMessages.push(...pendingMessages);
      offlineMessages.delete(userData.username);
      console.log(`Found ${pendingMessages.length} pending messages for ${userData.username}`);
    }
    
    // Check for temporary messages (from first user scenario)
    offlineMessages.forEach((msgs, key) => {
      if (key.startsWith('temp_')) {
        msgs.forEach((msg) => {
          if (msg.username !== userData.username) {
            allPendingMessages.push(msg);
          }
        });
        offlineMessages.delete(key);
      }
    });
    
    // Also check if there are messages stored for "the other user"
    if (allUsernames.size === 2) {
      const otherUsername = Array.from(allUsernames).find(u => u !== userData.username);
      if (otherUsername && offlineMessages.has(otherUsername)) {
        const pendingMessages = offlineMessages.get(otherUsername);
        pendingMessages.forEach((msg) => {
          if (msg.username !== userData.username) {
            allPendingMessages.push(msg);
          }
        });
        offlineMessages.delete(otherUsername);
      }
    }

    // Send all pending messages at once with a flag
    if (allPendingMessages.length > 0) {
      // First emit a signal that pending messages are coming
      socket.emit('pending-messages-start', { count: allPendingMessages.length });
      
      // Then send all pending messages
      allPendingMessages.forEach((msg, index) => {
        setTimeout(() => {
          socket.emit('receive-message', { ...msg, isPending: true });
        }, index * 50); // Small delay between messages
      });
      
      console.log(`Sent ${allPendingMessages.length} pending messages to ${userData.username}`);
    }
  });

  // Handle sending messages
  socket.on('send-message', (messageData) => {
    // Find the recipient username (the other user)
    const currentUser = users.get(socket.id);
    if (!currentUser) return;

    // Generate unique message ID if not present
    const messageId = messageData.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageWithId = { ...messageData, id: messageId, status: 'sent' };

    // Initialize message status
    messageStatus.set(messageId, {
      delivered: false,
      read: false,
      sender: currentUser.username
    });

    // Get all connected usernames
    const connectedUsernames = Array.from(usernameToSocket.keys());
    const recipientUsername = connectedUsernames.find(u => u !== currentUser.username);

    // Determine the recipient (the other user in the 2-user system)
    let recipient = recipientUsername;
    if (!recipient && allUsernames.size === 2) {
      // If recipient is not connected but we know who they are from allUsernames
      recipient = Array.from(allUsernames).find(u => u !== currentUser.username);
    }

    // If recipient is online, send message directly
    if (recipient && usernameToSocket.has(recipient)) {
      const recipientSocketId = usernameToSocket.get(recipient);
      io.to(recipientSocketId).emit('receive-message', messageWithId);
      console.log(`📨 Message sent to ONLINE user: ${recipient}`);
      console.log(`🔕 Push notification NOT sent: ${recipient} is ONLINE`);
      // Don't send push notification - user is online and will receive via socket
    } else if (recipient) {
      // Recipient is offline, store message for them
      if (!offlineMessages.has(recipient)) {
        offlineMessages.set(recipient, []);
      }
      offlineMessages.get(recipient).push(messageWithId);
      console.log(`💾 Message stored for OFFLINE user: ${recipient}`);
      
      // Send push notification ONLY when user is offline
      console.log(`🔔 Sending push notification to OFFLINE user: ${recipient}`);
      sendPushNotification(recipient, messageWithId);
    } else {
      // Can't determine recipient yet (first user scenario)
      // Store with sender's username as key, will be handled when second user logs in
      const tempKey = `temp_${currentUser.username}`;
      if (!offlineMessages.has(tempKey)) {
        offlineMessages.set(tempKey, []);
      }
      offlineMessages.get(tempKey).push({ ...messageWithId, _recipient: 'other' });
      console.log('Message stored temporarily (first user scenario)');
    }

    // Also send to sender (for their own message display)
    socket.emit('receive-message', { ...messageWithId, status: 'sent' });
  });

  // Handle message delivery confirmation
  socket.on('message-delivered', ({ messageId }) => {
    if (messageStatus.has(messageId)) {
      messageStatus.set(messageId, {
        ...messageStatus.get(messageId),
        delivered: true
      });
      // Notify sender that message was delivered
      const status = messageStatus.get(messageId);
      const senderSocketId = usernameToSocket.get(status.sender);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-status-update', {
          messageId,
          status: 'delivered'
        });
      }
    }
  });

  // Handle message read confirmation
  socket.on('message-read', ({ messageId }) => {
    if (messageStatus.has(messageId)) {
      messageStatus.set(messageId, {
        ...messageStatus.get(messageId),
        read: true
      });
      // Notify sender that message was read
      const status = messageStatus.get(messageId);
      const senderSocketId = usernameToSocket.get(status.sender);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message-status-update', {
          messageId,
          status: 'read'
        });
      }
    }
  });

  // Handle ping (keepalive)
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle typing indicator
  socket.on('typing-start', (userData) => {
    typingUsers.add(socket.id);
    socket.broadcast.emit('user-typing', userData);
  });

  socket.on('typing-stop', (userData) => {
    typingUsers.delete(socket.id);
    socket.broadcast.emit('user-stopped-typing', userData);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const userData = users.get(socket.id);
    if (userData) {
      socket.broadcast.emit('user-left', userData);
      users.delete(socket.id);
      usernameToSocket.delete(userData.username);
      console.log(`❌ ${userData.username} is now OFFLINE`);
      console.log(`📊 Total online users: ${usernameToSocket.size}`);
    }
    typingUsers.delete(socket.id);
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


