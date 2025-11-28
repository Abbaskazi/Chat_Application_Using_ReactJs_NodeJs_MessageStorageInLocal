# Chat Application

A real-time chat application with Snapchat-like ephemeral messaging (messages are deleted on refresh).

## Features

- ✅ **Authentication**: Simple username-based login
- ✅ **Real-time Messaging**: Instant message delivery using Socket.IO
- ✅ **Web Push Notifications**: Receive notifications even when browser is closed
- ✅ **WhatsApp-style Delivery Receipts**: Single tick (sent), double gray tick (delivered), double blue tick (read)
- ✅ **Typing Indicators**: See when the other user is typing
- ✅ **Ephemeral Messages**: Messages are stored in localStorage and cleared on refresh
- ✅ **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- ✅ **Modern UI**: Beautiful gradient design with smooth animations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Generate VAPID keys for Web Push Notifications:
```bash
node generate-vapid-keys.js
```

4. Copy the generated keys and either:
   - Set them as environment variables:
     ```bash
     export PUBLIC_VAPID_KEY="your-public-key"
     export PRIVATE_VAPID_KEY="your-private-key"
     ```
   - Or update them directly in `server.js` (not recommended for production)

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Step 1: Start the Backend Server

In the `backend` directory, run:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Step 2: Start the Frontend

In the `frontend` directory, run:
```bash
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is busy)

## Usage

1. Open the application in your browser (usually `http://localhost:5173`)
2. Enter a username to login
3. Open another browser tab/window (or use incognito mode) to simulate a second user
4. Enter a different username for the second user
5. Start chatting! Messages will appear in real-time
6. When you type, the other user will see a "typing..." indicator
7. Messages are stored in localStorage and will be cleared when you refresh the page

## How It Works

- **Real-time Communication**: Uses Socket.IO for bidirectional communication between clients and server
- **Local Storage**: Messages are temporarily stored in browser's localStorage for persistence during the session
- **Auto-clear on Refresh**: When the page is refreshed, localStorage is cleared, making messages ephemeral like Snapchat
- **Typing Indicators**: Detects when a user is typing and broadcasts it to other users in real-time

## Project Structure

```
chat Application/
├── backend/
│   ├── server.js          # Express + Socket.IO server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth.jsx   # Authentication component
│   │   │   ├── Auth.css
│   │   │   ├── Chat.jsx   # Main chat component
│   │   │   └── Chat.css
│   │   ├── App.jsx        # Main app component
│   │   └── main.jsx       # Entry point
│   └── package.json
└── README.md
```

## Technologies Used

- **Frontend**: React, Socket.IO Client, Service Worker, Web Push API
- **Backend**: Node.js, Express, Socket.IO, Web Push (web-push library)
- **Styling**: CSS3 with modern gradients and animations

## Web Push Notifications

This app uses Web Push Notifications to send notifications even when the browser is closed. The notifications are sent from the backend server, not from the React frontend.

### How it works:

1. User subscribes to push notifications when they log in
2. Subscription is saved on the backend
3. When a message is sent to an offline user, the backend sends a push notification
4. The Service Worker receives the push event and displays the notification
5. User receives notification even if browser is completely closed

### Setup:

1. Generate VAPID keys (one-time setup):
   ```bash
   cd backend
   node generate-vapid-keys.js
   ```

2. Set the keys as environment variables or update `server.js`

3. The frontend will automatically subscribe to push when user logs in

## Notes

- Make sure both backend and frontend servers are running simultaneously
- The backend server must be running before the frontend can connect
- For testing with 2 users, use different browser tabs/windows or incognito mode
- Messages are only stored locally and are not persisted on the server


