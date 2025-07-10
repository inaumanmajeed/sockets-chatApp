import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface User {
  id?: string;
  username: string;
  avatar?: string;
  lastSeen?: Date;
  isOnline?: boolean;
  email?: string;
  friends?: Array<string>;
  groups?: Array<string>;
}

export interface Message {
  id: number;
  senderId: string;
  senderName: string;
  recipientId?: string;
  text: string;
  timestamp: Date;
  type: "message" | "private";
}

export interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
  chatMode?: "public" | "private";
  recipientId?: string;
}

const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const serverUrl = import.meta.env.VITE_BACKEND_URL;
  const user = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user") || "{}")
    : null;

  const accessToken = user?.accessToken || "";

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(serverUrl, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      auth: {
        token: accessToken,
      },
    });

    setSocket(newSocket);

    // Connection event handlers
    newSocket.on("connect", () => {
      console.log("🟢 Connected to server");
      setIsConnected(true);
    });
    // Handle disconnection
    newSocket.on("disconnect", () => {
      console.log("🔴 Disconnected from server");
      setIsConnected(false);
    });
    // Handle connection errors
    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      setIsConnected(false);
    });
    // Handle reconnection attempts
    newSocket.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Reconnecting... Attempt #${attempt}`);
    });
    // Handle connected users
    newSocket.on("connectedUsers", (users: User[]) => {
      console.log("Connected users:", users);
    });

    // Connect the socket
    newSocket.connect();

    newSocket.on("jwtVerificationFailed", (error) => {
      console.error("❌ JWT verification failed:", error);

      switch (error.code) {
        case "TOKEN_EXPIRED": {
          console.warn("🕒 Token expired, attempting to refresh...");
          // Try to refresh the token
          const userData = localStorage.getItem("user");
          if (userData) {
            const parsedData = JSON.parse(userData);
            if (parsedData.refreshToken) {
              console.log("🔄 Attempting token refresh...");
              newSocket.emit("refreshAccessToken", {
                refreshToken: parsedData.refreshToken,
              });
            } else {
              console.warn(
                "🚫 No refresh token available, redirecting to login..."
              );
              localStorage.removeItem("user");
              window.location.href = "/login";
            }
          } else {
            console.warn("🚫 No user data, redirecting to login...");
            window.location.href = "/login";
          }
          break;
        }
        case "NO_TOKEN":
          console.warn("🚫 No token provided, redirecting to login...");
          window.location.href = "/login";
          break;
        case "USER_NOT_FOUND":
          console.warn("👤 User not found, clearing localStorage...");
          localStorage.removeItem("user");
          window.location.href = "/login";
          break;
        default:
          console.error(
            "❓ Unknown error occurred:",
            error.details || error.error
          );
          break;
      }
    });

    newSocket.on("accessTokenRefreshed", (data) => {
      console.log("✅ Access token refreshed successfully:", data);

      // Update localStorage with new tokens
      const userDataToStore = {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      localStorage.setItem("user", JSON.stringify(userDataToStore));
      newSocket.auth = {
        token: data.accessToken,
      };
      // reconnect socket with new token
      newSocket.connect();
    });

    newSocket.on("refreshError", (error) => {
      console.error("❌ Token refresh failed:", error);
      console.warn("🚫 Refresh token invalid, redirecting to login...");
      localStorage.removeItem("user");
      window.location.href = "/login";
    });

    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl, accessToken]);

  return {
    socket,
    isConnected,
  };
};

export default useSocket;
