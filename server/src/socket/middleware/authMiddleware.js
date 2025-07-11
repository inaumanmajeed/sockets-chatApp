import jwt from "jsonwebtoken";
import User from "../../models/User.model.js";
import { autoMarkMessagesAsDelivered } from "../utils/messageDelivery.js";

// Store connected users with additional metadata
export const connectedUsers = new Map();

export const createAuthMiddleware = (io) => {
  return async (socket, next) => {
    const [eventName] = socket.packet || [""];

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

      if (!token) {
        socket.emit("jwtVerificationFailed", {
          error: "Access token required",
          code: "NO_TOKEN",
        });
        return next(new Error("Access token required"));
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const user = await User.findById(decodedToken.id);

      if (!user) {
        socket.emit("jwtVerificationFailed", {
          error: "Invalid access token - user not found",
          code: "USER_NOT_FOUND",
        });
        return next(new Error("Invalid access token"));
      }

      socket.user = user;

      // Only update and auto-mark messages if this is a new connection or different socket
      if (
        !user.isOnline ||
        user.socketId !== socket.id ||
        !socket.messagesProcessed
      ) {
        const wasOffline = !user.isOnline;
        user.isOnline = true;
        user.socketId = socket.id;
        await user.save({
          validateModifiedOnly: true,
          runValidators: true,
        });

        // Automatically mark pending messages as delivered if not already processed
        if (!socket.messagesProcessed) {
          console.log(
            "📮 Auto-marking pending messages as delivered (was offline:",
            wasOffline,
            ")"
          );
          await autoMarkMessagesAsDelivered(user._id, socket.id, io);
          socket.messagesProcessed = true;
        }
      }

      connectedUsers.set(socket.id, {
        socketId: socket.id,
        userId: user._id,
      });
      io.emit("connectedUsers", Array.from(connectedUsers.values()));

      // Only emit JWT verification success once per connection
      if (!socket.jwtVerified) {
        socket.emit("jwtVerificationSuccess", {
          message: "Authentication successful",
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
        });
        socket.jwtVerified = true;
      }
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
  };
};
