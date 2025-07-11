import jwt from "jsonwebtoken";
import User from "../../models/User.model.js";
import { autoMarkMessagesAsDelivered } from "../utils/messageDelivery.js";

// Store connected users with additional metadata
export const connectedUsers = new Map();

export const createAuthMiddleware = () => {
  return async (socket, next) => {
    // This middleware runs on initial connection
    // We'll just establish the connection and handle auth per event
    console.log("New socket connection:", socket.id);
    next();
  };
};

// Authentication helper function to be called in each handler
export const authenticateSocket = async (socket, io) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      socket.emit("jwtVerificationFailed", {
        error: "Access token required",
        code: "NO_TOKEN",
      });
      return null;
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken.id);

    if (!user) {
      socket.emit("jwtVerificationFailed", {
        error: "Invalid access token - user not found",
        code: "USER_NOT_FOUND",
      });
      return null;
    }

    socket.user = user;
    console.log(user.lastSeen.toLocaleTimeString());

    // Mark user as online and update socket ID
    // Only update if the user is not already online or if the socket ID has changed
    // This prevents unnecessary updates if the user is already online with the same socket

    if (
      !user.isOnline ||
      user.socketId !== socket.id ||
      !socket.messagesProcessed
    ) {
      user.isOnline = true;
      user.socketId = socket.id;
      await user.save({
        validateModifiedOnly: true,
        runValidators: true,
      });

      // Automatically mark pending messages as delivered if not already processed
      // This ensures that the user sees their messages as delivered
      // This is only done once per connection to avoid redundant updates
      // This is useful for cases where the user reconnects and has pending messages
      // that need to be marked as delivered
      // Injected the messagesProcessed flag to prevent multiple updates

      if (!socket.messagesProcessed) {
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
    // This prevents multiple emissions if the user reconnects
    // and the socket is already authenticated
    // This is to ensure that the frontend only processes the success event once
    // and avoids unnecessary re-renders or state updates
    // Injected the jwtVerified flag to prevent multiple emissions

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

    return user;
  } catch (error) {
    console.error("JWT verification error:", error.message);

    let errorCode = "INVALID_TOKEN"; // Default error code
    let errorMessage = "Invalid access token";

    if (error.name === "TokenExpiredError") {
      errorCode = "TOKEN_EXPIRED"; // Specific error code for expired tokens
      errorMessage = "Access token has expired";
    } else if (error.name === "JsonWebTokenError") {
      errorCode = "MALFORMED_TOKEN"; // Specific error code for malformed tokens
      errorMessage = "Malformed access token";
    }

    socket.emit("jwtVerificationFailed", {
      error: errorMessage,
      code: errorCode,
      details: error.message,
    });

    return null;
  }
};
