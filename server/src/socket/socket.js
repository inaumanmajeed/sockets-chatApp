import { Server } from "socket.io";
import { CORS_ORIGIN } from "../constants/index.js";
import { createAuthMiddleware } from "./middleware/authMiddleware.js";
import { handleConnection, handleDisconnection } from "./handlers/connectionHandler.js";
import { 
  handleRegisterUser, 
  handleLoginUser, 
  handleRefreshAccessToken 
} from "./handlers/authHandler.js";
import { 
  handleSendPrivateMessage, 
  handleGetChatHistory, 
  handleMarkMessagesAsSeen, 
  handleUpdateMessageStatus 
} from "./handlers/messageHandler.js";
import { 
  handleSearchUsers, 
  handleGetFriendsList, 
  handleGetUnreadCount 
} from "./handlers/userHandler.js";

const initializeSocketIO = (app) => {
  const io = new Server(app, {
    cors: {
      origin: CORS_ORIGIN?.split(",") || "*",
      credentials: true,
    },
  });

  // Apply authentication middleware
  io.use(createAuthMiddleware(io));

  // Handle new socket connections
  io.on("connection", (socket) => {
    handleConnection(socket, io);

    // =======================================================================================
    // AUTHENTICATION HANDLERS
    // =======================================================================================
    socket.on("registerUser", handleRegisterUser(socket));
    socket.on("loginUser", handleLoginUser(socket, io));
    socket.on("refreshAccessToken", handleRefreshAccessToken(socket));

    // =======================================================================================
    // MESSAGE HANDLERS
    // =======================================================================================
    socket.on("sendPrivateMessageToUser", handleSendPrivateMessage(socket, io));
    socket.on("getChatHistory", handleGetChatHistory(socket));
    socket.on("markMessagesAsSeen", handleMarkMessagesAsSeen(socket, io));
    socket.on("updateMessageStatus", handleUpdateMessageStatus(socket, io));

    // =======================================================================================
    // USER HANDLERS
    // =======================================================================================
    socket.on("searchUsersWithUsername", handleSearchUsers(socket));
    socket.on("getFriendsList", handleGetFriendsList(socket));
    socket.on("getUnreadCount", handleGetUnreadCount(socket));

    // =======================================================================================
    // DISCONNECTION HANDLER
    // =======================================================================================
    socket.on("disconnect", handleDisconnection(socket, io));
  });

  return io;
};

export { initializeSocketIO };
