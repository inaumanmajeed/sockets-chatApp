import { Server } from "socket.io";
import { CORS_ORIGIN } from "../constants/index.js";
import User from "../models/User.model.js";
import jwt from "jsonwebtoken";
import UserChat from "../models/userChats.model.js";

// Store connected users with additional metadata
const connectedUsers = new Map();

// GENERATE ACCESS AND REFRESH TOKENS

const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  // Save the refresh token and access token to the user document
  user.refreshToken = refreshToken;
  user.accessToken = accessToken;
  await user.save({
    validateModifiedOnly: true, // Only validate modified fields
    runValidators: true, // Run validators for the modified fields
  });
  return { accessToken, refreshToken };
};

const initializeSocketIO = (app) => {
  const io = new Server(app, {
    cors: {
      origin: CORS_ORIGIN?.split(",") || "*",
      credentials: true,
    },
  });

  // Handle new socket connections
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // =======================================================================================
    // Middleware to verify JWT from incoming requests (skip for certain events)
    socket.use(async (packet, next) => {
      const [eventName] = packet;

      // Skip authentication for these events
      const publicEvents = [
        "registerUser",
        "loginUser",
        "refreshAccessToken",
        "accessTokenRefreshed",
      ];

      if (publicEvents.includes(eventName)) {
        return next();
      }

      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        console.log("🔍 Checking token for event:", eventName);
        console.log("🔑 Token received:", token ? "Yes" : "No");

        if (!token) {
          console.log("❌ JWT verification failed: No token provided");
          socket.emit("jwtVerificationFailed", {
            error: "Access token required",
            code: "NO_TOKEN",
          });
          return next(new Error("Access token required"));
        }

        console.log("🕐 Verifying token...");
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        console.log("🔓 Token decoded successfully. User ID:", decodedToken.id);

        const user = await User.findById(decodedToken.id);

        if (!user) {
          console.log("❌ JWT verification failed: User not found");
          socket.emit("jwtVerificationFailed", {
            error: "Invalid access token - user not found",
            code: "USER_NOT_FOUND",
          });
          return next(new Error("Invalid access token"));
        }

        socket.user = user;
        if (!user.isOnline || user.socketId !== socket.id) {
          console.log("🔗 Updating user online status and socket ID");
          user.isOnline = true;
          user.socketId = socket.id;
          await user.save({
            validateModifiedOnly: true,
            runValidators: true,
          });
        }
        connectedUsers.set(socket.id, {
          socketId: socket.id,
          userId: user._id,
        });
        console.log("Connected users:", Array.from(connectedUsers.values()));
        console.log("✅ JWT verification successful for user:", user.username);
        socket.emit("jwtVerificationSuccess", {
          message: "Authentication successful",
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
        });
        next();
      } catch (error) {
        console.error("JWT verification error:", error.message);

        let errorCode = "INVALID_TOKEN";
        let errorMessage = "Invalid access token";

        if (error.name === "TokenExpiredError") {
          errorCode = "TOKEN_EXPIRED";
          errorMessage = "Access token has expired";
        } else if (error.name === "JsonWebTokenError") {
          errorCode = "MALFORMED_TOKEN";
          errorMessage = "Malformed access token";
        }

        socket.emit("jwtVerificationFailed", {
          error: errorMessage,
          code: errorCode,
          details: error.message,
        });

        next(new Error("Invalid access token"));
      }
    });

    // =======================================================================================
    //functionality to register a user
    socket.on("registerUser", async (userData) => {
      console.log("🚀 registerUser event received:", userData);
      console.log("Socket ID:", socket.id);

      const { username, email, password } = userData;
      try {
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ username }, { email }],
        });

        if (existingUser) {
          socket.emit(
            "registrationError",
            "Username or email already exists. Please try with different details."
          );
          return;
        }

        // Create new user
        const newUser = new User({
          username,
          email,
          password,
          socketId: socket.id,
        });

        // Save user to the database
        await newUser.save();

        // Add user to connected users map
        connectedUsers.set(socket.id, {
          ...userData,
          socketId: socket.id,
          userId: newUser._id,
        });

        // Acknowledge successful registration
        socket.emit("registrationSuccess", {
          message: "User registered successfully!",
          user: newUser,
        });
      } catch (error) {
        console.error("Error registering user:", error);
        socket.emit(
          "registrationError",
          `Failed to register user. 🔴ERROR ${error.message}`
        );
      }
    });

    // =======================================================================================
    // Functionality to login a user
    socket.on("loginUser", async (loginData) => {
      console.log("User login attempt:", loginData);

      const { username, password } = loginData;
      try {
        // Find user by username or email
        const user = await User.findOne({
          $or: [{ username }, { email: username }],
        });

        if (!user) {
          socket.emit("loginError", "Invalid username or password");
          return;
        }

        // Check password (assuming you have a password comparison method)
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          socket.emit("loginError", "Invalid username or password");
          return;
        }

        // Generate tokens
        const { accessToken, refreshToken } =
          await generateAccessAndRefreshTokens(user._id);

        // Update socket user
        socket.user = user;

        // Add user to connected users map
        connectedUsers.set(socket.id, {
          id: user._id,
          socketId: socket.id,
        });

        // Send success response with tokens
        socket.emit("loginSuccess", {
          message: "Login successful!",
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
          accessToken,
          refreshToken,
        });
      } catch (error) {
        console.error("Error logging in user:", error);
        socket.emit("loginError", `Failed to login. ERROR: ${error.message}`);
      }
    });

    // =======================================================================================
    // Functionality to refresh access token
    socket.on("refreshAccessToken", async (data) => {
      try {
        const refreshToken =
          typeof data === "string" ? data : data.refreshToken;

        if (!refreshToken) {
          console.log("❌ No refresh token provided");
          socket.emit("refreshError", "Refresh token is required");
          return;
        }

        // Find user by refresh token
        const user = await User.findOne({ refreshToken: refreshToken });
        if (!user) {
          console.log("❌ User not found for refresh token");
          socket.emit("refreshError", "Invalid refresh token");
          return;
        }
        // Generate new access and refresh tokens
        const { accessToken, refreshToken: newRefreshToken } =
          await generateAccessAndRefreshTokens(user._id);

        // Send new tokens to the client
        socket.emit("accessTokenRefreshed", {
          message: "Token refreshed successfully",
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
          accessToken,
          refreshToken: newRefreshToken,
        });
      } catch (error) {
        console.error("Error refreshing access token:", error);
        socket.emit(
          "refreshError",
          `Failed to refresh token. ERROR: ${error.message}`
        );
      }
    });

    // =======================================================================================
    // functionality to send a message to a user
    socket.on("sendPrivateMessageToUser", async (messageData) => {
      const { recipientId, message } = messageData;
      try {
        // Validate recipient ID
        if (!recipientId || !message) {
          socket.emit(
            "sendMessageError",
            "Recipient ID and message are required"
          );
          return;
        }
        // Find recipient user
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          socket.emit("sendMessageError", "Recipient not found");
          return;
        }

        // check if recipient is in user's friends list if not then add them
        await User.findByIdAndUpdate(
          socket.user._id,
          {
            $addToSet: { friends: recipient._id },
          },
          {
            new: true,
            runValidators: true,
          }
        );

        // Prepare message data
        const messageDataToSend = {
          senderId: socket.user._id,
          senderUsername: socket.user.username,
          recipientId: recipient._id,
          recipientUsername: recipient.username,
          message: message,
          status: "sent",
          timestamp: new Date(),
        };

        // Save the message to the database
        // Find or create chat between these two users
        const participants = [socket.user._id, recipient._id].sort(); // Sort to ensure consistent order

        let userChat = await UserChat.findOne({
          participants: { $all: participants, $size: 2 },
        });

        if (!userChat) {
          // Create new chat if it doesn't exist
          userChat = new UserChat({
            participants: participants,
            messages: [messageDataToSend],
          });
        } else {
          // Add message to existing chat
          userChat.messages.push(messageDataToSend);
        }

        await userChat.save();

        // Emit message to recipient (if online)
        if (recipient.socketId) {
          io.to(recipient.socketId).emit(
            "privateMessageReceived",
            messageDataToSend
          );
        }

        console.log("📩 Message sent to recipient:", recipient.username);
        // Acknowledge message sent
        socket.emit("sendMessageSuccess", {
          message: "Message sent successfully",
          recipient: {
            id: recipient._id,
            username: recipient.username,
          },
          messageData: messageDataToSend,
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit(
          "sendMessageError",
          `Failed to send message. ERROR: ${error.message}`
        );
      }
    });

    // =======================================================================================
    // functionality to get chat history between two users
    socket.on("getChatHistory", async (data) => {
      console.log("🔍 Get chat history request:", data);
      const { userId } = data;

      try {
        if (!userId) {
          socket.emit("getChatHistoryError", "User ID is required");
          return;
        }

        // Find chat between current user and requested user
        const participants = [socket.user._id, userId].sort(); // Sort to ensure consistent order

        const userChat = await UserChat.findOne({
          participants: { $all: participants, $size: 2 },
        }).populate("participants", "username email");

        if (!userChat) {
          // No chat history found
          socket.emit("getChatHistorySuccess", {
            messages: [],
            participants: participants,
            count: 0,
          });
          return;
        }

        // Return chat history
        socket.emit("getChatHistorySuccess", {
          messages: userChat.messages,
          participants: userChat.participants,
          count: userChat.messages.length,
        });

        console.log("📚 Chat history sent for users:", participants);
      } catch (error) {
        console.error("Error getting chat history:", error);
        socket.emit(
          "getChatHistoryError",
          `Failed to get chat history. ERROR: ${error.message}`
        );
      }
    });

    // =======================================================================================
    // Functionality to mark messages as delivered or seen
    socket.on("updateMessageStatus", async (data) => {
      console.log("🔄 Update message status request:", data);
      const { chatId, messageId, status } = data;
      try {
        if (!chatId || !messageId || !status) {
          socket.emit(
            "updateMessageStatusError",
            "Chat ID, message ID, and status are required"
          );
          return;
        }
        // Validate status
        const validStatuses = ["sent", "delivered", "seen"];
        if (!validStatuses.includes(status)) {
          socket.emit("updateMessageStatusError", "Invalid status provided");
          return;
        }
        // Find chat by ID
        const userChat = await UserChat.findById(chatId);
        if (!userChat) {
          socket.emit("updateMessageStatusError", "Chat not found");
          return;
        }
        // Find message by ID
        const message = userChat.messages.id(messageId);
        if (!message) {
          socket.emit("updateMessageStatusError", "Message not found");
          return;
        }
        // Update message status
        message.status = status;
        await userChat.save();
        console.log("✅ Message status updated:", messageId, "to", status);
        // Emit updated message to both users in the chat
        io.to(userChat.participants.map((p) => p.toString())).emit(
          "messageStatusUpdated",
          {
            chatId: userChat._id,
            messageId: message._id,
            status: status,
            updatedMessage: message,
          }
        );
        // Acknowledge status update
        socket.emit("updateMessageStatusSuccess", {
          message: "Message status updated successfully",
          chatId: userChat._id,
          messageId: message._id,
          status: status,
          updatedMessage: message,
        });
      } catch (error) {
        console.error("Error updating message status:", error);
        socket.emit(
          "updateMessageStatusError",
          `Failed to update message status. ERROR: ${error.message}`
        );
      }
    });
    // =======================================================================================
    // Functionality to get all registered users from db with username search
    socket.on("searchUsersWithUsername", async (searchData) => {
      try {
        let query = {};
        let projection = { password: 0, refreshToken: 0, accessToken: 0 };

        // If search term is provided, create a case-insensitive regex search
        if (searchData && searchData.username && searchData.username.trim()) {
          const searchTerm = searchData.username.trim();

          query = {
            username: { $regex: searchTerm, $options: "i" }, // Case-insensitive search
          };
          console.log("🔍 Searching for username containing:", searchTerm);
        } else {
          console.log("🔍 Fetching all users");
        }

        const users = await User.find(query, projection).limit(50); // Limit results to prevent large responses
        console.log("🚀 ~ Found users:", users.length);

        socket.emit("searchUsersWithUsernameSuccess", {
          message: "Users fetched successfully",
          users: users,
          count: users.length,
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        socket.emit("searchUsersWithUsernameError", {
          message: "Failed to fetch users",
          error: error.message,
        });
      }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      connectedUsers.delete(socket.id);
      if (socket.user) {
        // Update user status to offline
        User.findByIdAndUpdate(
          socket.user._id,
          { isOnline: false, socketId: null },
          { new: true, runValidators: true }
        )
          .then((updatedUser) => {
            console.log(
              "😴😴😴😴😴User status updated to offline:",
              updatedUser.username
            );
          })
          .catch((error) => {
            console.error("Error updating user status:", error);
          });
      }

      io.emit("connectedUsers", Array.from(connectedUsers.values()));
    });

    // =======================================================================================
  });

  return io;
};

export { initializeSocketIO };
