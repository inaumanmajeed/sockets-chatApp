import { useEffect, useState, useCallback } from "react";
import useSocket from "./useSocket";
import type { User } from "./useSocket";
import type { ChatHistory, message, SearchResult } from "../types/types";

const useFriends = () => {
  const { socket, isConnected } = useSocket();
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [chatMessages, setChatMessages] = useState<message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{
    [userId: string]: number;
  }>({});
  const [totalUnread, setTotalUnread] = useState(0);

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

  // Mark messages as seen function
  const markMessagesAsSeen = useCallback(
    (chatPartnerId: string) => {
      if (!isConnected || !socket) {
        console.error("Socket not connected");
        return;
      }

      socket.emit("markMessagesAsSeen", { chatPartnerId });
    },
    [socket, isConnected]
  );

  // Update individual message status
  const updateMessageStatus = useCallback(
    (
      messageId: string,
      status: "sent" | "delivered" | "seen",
      chatPartnerId?: string
    ) => {
      if (!isConnected || !socket) {
        console.error("Socket not connected");
        return;
      }

      socket.emit("updateMessageStatus", { messageId, status, chatPartnerId });
    },
    [socket, isConnected]
  );

  // Get friends/recent chats function
  const getFriendsList = useCallback(() => {
    if (!isConnected || !socket) {
      console.error("Socket not connected");
      return;
    }

    socket.emit("getFriendsList");
  }, [socket, isConnected]);

  // Get unread message counts
  const getUnreadCount = useCallback(() => {
    if (!isConnected || !socket) {
      console.error("Socket not connected");
      return;
    }

    socket.emit("getUnreadCount");
  }, [socket, isConnected]);

  // Load friends list and unread counts when socket connects
  useEffect(() => {
    if (isConnected && socket) {
      // Check if user is already authenticated (has token)
      const user = localStorage.getItem("user");
      if (user) {
        console.log(
          "Socket connected and user is authenticated, loading initial data"
        );
        getFriendsList();
        getUnreadCount();
      }
    }
  }, [isConnected, socket, getFriendsList, getUnreadCount]);

  // Socket event listeners
  useEffect(() => {
    socket?.on("privateMessageReceived", (message: message) => {
      console.log("Received private message:", message);
      setChatMessages((prev) => [...prev, message]);

      // Automatically update status to delivered when message is received
      if (message._id && socket?.connected) {
        updateMessageStatus(message._id, "delivered", message.senderId);
      }
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

    // Listen for message status updates
    socket?.on(
      "messageStatusUpdated",
      (data: {
        chatId: string;
        messageId: string;
        status: "sent" | "delivered" | "seen";
        updatedBy: string;
        updatedMessage: message;
      }) => {
        console.log("📨 Message status updated:", data);
        console.log("📨 Updating message with ID:", data.messageId);
        console.log("📨 New status:", data.status);

        setChatMessages((prev) => {
          const updated = prev.map((msg) => {
            // Try multiple ID comparison methods to be safe
            const msgId = msg._id;
            const dataMessageId = data.messageId;

            console.log("📨 Comparing:", msgId, "vs", dataMessageId);

            if (
              msgId === dataMessageId ||
              String(msgId) === String(dataMessageId) ||
              msg.timestamp === data.updatedMessage.timestamp
            ) {
              console.log(
                "✅ Found matching message, updating status to:",
                data.status
              );
              return { ...msg, status: data.status };
            }
            return msg;
          });

          console.log("📨 Messages after update:", updated);
          return updated;
        });
      }
    );

    // Listen for messages marked as seen notification
    socket?.on(
      "messagesMarkedAsSeen",
      (data: {
        chatId: string;
        seenBy: string;
        seenByUsername: string;
        count: number;
      }) => {
        console.log("Messages marked as seen:", data);
        // Update all messages sent by current user to this chat partner as seen
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.recipientId === data.seenBy && msg.status !== "seen"
              ? { ...msg, status: "seen" }
              : msg
          )
        );
      }
    );

    // Listen for friends list
    socket?.on("friendsListSuccess", (data: { friends: User[] }) => {
      console.log("Received friends list:", data);
      setFriendsList(data.friends);
    });

    // Listen for unread counts
    socket?.on(
      "unreadCountSuccess",
      (data: {
        totalUnread: number;
        unreadByUser: { [userId: string]: number };
      }) => {
        console.log("Received unread counts:", data);
        setTotalUnread(data.totalUnread);
        setUnreadCounts(data.unreadByUser);
      }
    );

    // Listen for JWT verification success to automatically load friends and unread counts
    socket?.on("jwtVerificationSuccess", () => {
      console.log("JWT verified, loading friends list and unread counts");
      getFriendsList();
      getUnreadCount();
    });

    // Listen for batch delivery updates (when user comes online)
    socket?.on(
      "batchDeliveryUpdate",
      (data: { count: number; userId: string; username: string }) => {
        console.log(`📦 ${data.count} messages delivered to ${data.username}`);
        // You can add a toast notification here if needed
      }
    );

    // Cleanup event listeners
    return () => {
      socket?.off("privateMessageReceived");
      socket?.off("getChatHistorySuccess");
      socket?.off("getChatHistoryError");
      socket?.off("messageStatusUpdated");
      socket?.off("messagesMarkedAsSeen");
      socket?.off("friendsListSuccess");
      socket?.off("unreadCountSuccess");
      socket?.off("jwtVerificationSuccess");
      socket?.off("batchDeliveryUpdate");
    };
  }, [
    socket,
    isConnected,
    updateMessageStatus,
    getFriendsList,
    getUnreadCount,
  ]);

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
      console.log("Message data with ID:", response.messageData);
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
    markMessagesAsSeen,
    updateMessageStatus,
    getFriendsList,
    getUnreadCount,
    chatMessages,
    searchResults,
    isSearching,
    isLoadingHistory,
    friendsList,
    unreadCounts,
    totalUnread,
  };
};

export default useFriends;
