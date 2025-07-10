# Real-time Chat Application

A full-stack real-time chat application built with React, Socket.IO, Node.js, and MongoDB.

## Features

- 🚀 Real-time messaging with Socket.IO
- 👥 User presence (see who's online)
- ⌨️ Typing indicators
- 🎨 Modern UI with Tailwind CSS
- 📱 Responsive design
- 🔒 Real-time connection status

## Tech Stack

### Frontend

- **React 19** with TypeScript
- **Socket.IO Client** for real-time communication
- **Tailwind CSS** for styling
- **Vite** for fast development
- **Custom React Hooks** for socket management

### Backend

- **Node.js** with Express
- **Socket.IO** for WebSocket connections
- **MongoDB** with Mongoose
- **CORS** enabled for cross-origin requests

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (running locally or connection string)
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd chatApp
   ```

2. **Install server dependencies**

   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**

   ```bash
   cd ../client
   npm install
   ```

4. **Set up environment variables**

   Server (`.env` in `/server`):

   ```env
   MONGO_DB_URL=mongodb://localhost:27017
   MONGO_DB_NAME=chatApp
   PORT=8000
   CORS_ORIGIN=http://localhost:5174
   ```

   Client (`.env` in `/client`):

   ```env
   VITE_BACKEND_URL=http://localhost:8000
   ```

### Running the Application

1. **Start MongoDB** (if running locally)

   ```bash
   mongod
   ```

2. **Start the server** (from `/server` directory)

   ```bash
   npm start
   ```

3. **Start the client** (from `/client` directory)

   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:5174` (or the port shown in terminal)
   - Enter a username to join the chat

## Project Structure

```
chatApp/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── Chat.tsx
│   │   │   ├── Login.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── useSocket.ts
│   │   │   └── useTypingIndicator.ts
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # App entry point
│   ├── package.json
│   └── .env
└── server/                 # Node.js backend
    ├── src/
    │   ├── constants/      # App constants
    │   ├── db/            # Database connection
    │   └── socket/        # Socket.IO configuration
    │       └── socket.js
    ├── app.js             # Express app setup
    ├── index.js           # Server entry point
    ├── package.json
    └── .env
```

## Key Features Implementation

### Socket.IO Events

**Client Events:**

- `join` - User joins with username
- `send_message` - Send public message
- `send_private_message` - Send private message
- `typing` - Typing indicator

**Server Events:**

- `users_list` - Current online users
- `user_joined` - New user joined
- `user_left` - User disconnected
- `receive_message` - New public message
- `receive_private_message` - New private message
- `user_typing` - Someone is typing

### Custom React Hooks

**`useSocket`** - Main socket management

- Connection handling
- User management
- Message handling
- Typing indicators

**`useTypingIndicator`** - Typing indicator logic

- Debounced typing detection
- Auto-stop typing after delay

## Development

### Available Scripts

**Server:**

- `npm start` - Start server with nodemon
- `npm run dev` - Development mode

**Client:**

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### VS Code Tasks

Two tasks are configured in `.vscode/tasks.json`:

- **Start Chat Server** - Runs the backend server
- **Start Chat Client** - Runs the frontend development server

## Testing the Application

1. Open multiple browser tabs/windows
2. Join with different usernames
3. Send messages and see real-time updates
4. Test typing indicators
5. Check user presence (online/offline status)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for learning and development.
# sockets-chatApp
