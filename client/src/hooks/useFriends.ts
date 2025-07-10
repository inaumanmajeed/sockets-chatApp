import { useEffect, useState, useCallback } from "react";
import useSocket from "./useSocket";
import type { User } from "./useSocket";

export interface SearchResult {
  users: User[];
  count?: number;
  message?: string;
}
export interface message {
  recipientId: string;
  senderId: string;
  recipientUsername: string;
  senderUsername: string;
  message: string;
  timestamp: Date;
  status: string;
}

interface ChatHistory {
  messages: message[];
  participants: string[];
  count: number;
}

const useFriends = () => {
  const { socket, isConnected } = useSocket();
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessages, setChatMessages] = useState<message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Get chat history function
  const getChatHistory = useCallback(
    (userId: string) => {
      if (!isConnected || !socket) {
        console.error("Socket not connected");
        return;
      }

      setIsLoadingHistory(true);
      socket.emit("getChatHistory", { userId });
    },
    [socket, isConnected]
  );

  // Search for a friend function
  const handleSearchFriend = useCallback(
    (username: string) => {
      if (!isConnected || !socket) {
        console.error("Socket not connected");
        return;
      }

      if (!username.trim()) {
        console.error("Username cannot be empty");
        return;
      }

      setIsSearching(true);
      socket.emit("searchUsersWithUsername", { username });
    },
    [socket, isConnected]
  );

  // Send Private Message to a user
  const handleSendPrivateMessage = useCallback(
    (recipientId: string | undefined, message: string) => {
      if (!isConnected || !socket) {
        console.error("Socket not connected");
        return;
      }
      if (!recipientId || !message.trim()) {
        console.error("Recipient ID and message cannot be empty");
        return;
      }
      socket.emit("sendPrivateMessageToUser", { recipientId, message });
    },
    [socket, isConnected]
  );

  // Receive Private Message from a user
  useEffect(() => {
    socket?.on("privateMessageReceived", (message: message) => {
      console.log("Received private message:", message);
      setChatMessages((prev) => [...prev, message]);
    });

    // Listen for chat history
    socket?.on("getChatHistorySuccess", (data: ChatHistory) => {
      console.log("Received chat history:", data);
      setChatMessages(data.messages);
      setIsLoadingHistory(false);
    });

    socket?.on("getChatHistoryError", (error: string) => {
      console.error("Error getting chat history:", error);
      setIsLoadingHistory(false);
    });

    // Cleanup event listeners
    return () => {
      socket?.off("privateMessageReceived");
      socket?.off("getChatHistorySuccess");
      socket?.off("getChatHistoryError");
    };
  }, [socket, isConnected]);

  useEffect(() => {
    if (!isConnected || !socket) return;
    // Listen for search results
    const handleSearchResults = (results: SearchResult) => {
      setSearchResults(results);
      setIsSearching(false);
    };
    //   Listen for message send success
    const handleMessageSentSuccess = (response: {
      message: string;
      recipient: { id: string; username: string };
      messageData: message;
    }) => {
      console.log("Message sent successfully to:", response?.recipient.id);
      // Add the sent message to local state
      setChatMessages((prev) => [...prev, response.messageData]);
    };

    socket.on("searchUsersWithUsernameSuccess", handleSearchResults);
    socket.on("sendMessageSuccess", handleMessageSentSuccess);

    // Cleanup event listener
    return () => {
      socket.off("searchUsersWithUsernameSuccess", handleSearchResults);
      socket.off("sendMessageSuccess", handleMessageSentSuccess);
    };
  }, [isConnected, socket]);

  return {
    handleSearchFriend,
    handleSendPrivateMessage,
    getChatHistory,
    chatMessages,
    searchResults,
    isSearching,
    isLoadingHistory,
  };
};

export default useFriends;
