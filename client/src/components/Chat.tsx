import useFriends from "../hooks/useFriends";
import UserIcon from "../assets/user.jpg";
import { useState, useEffect, useRef } from "react";
import type { User } from "../hooks/useSocket";
import type { message } from "../types/types";
import SentIcon from "../assets/sent.svg";
import DeliveredIcon from "../assets/Delivered.svg";
import ReadIcon from "../assets/Read.svg";

const Chat = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    handleSearchFriend,
    searchResults,
    handleSendPrivateMessage,
    getChatHistory,
    markMessagesAsSeen,
    chatMessages,
    isLoadingHistory,
    friendsList,
    unreadCounts,
    totalUnread,
  } = useFriends();

  // Get current user from localStorage
  const currentUser = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user") || "{}")
    : null;
  const currentUserId = currentUser?.user?.id;

  const users = searchResults?.users || [];

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    // Load chat history when user is selected
    getChatHistory(user.id || "");
    // Mark messages as seen when opening chat
    markMessagesAsSeen(user.id || "");
  };

  // Filter messages for the selected user
  const filteredMessages = chatMessages.filter((msg: message) => {
    const msgSenderId = String(msg.senderId);
    const msgRecipientId = String(msg.recipientId);
    const currentUserIdStr = String(currentUserId);
    const selectedUserIdStr = String(selectedUser?.id);

    return (
      (msgSenderId === currentUserIdStr &&
        msgRecipientId === selectedUserIdStr) ||
      (msgSenderId === selectedUserIdStr && msgRecipientId === currentUserIdStr)
    );
  });

  console.log("🚀 ~ Chat ~ filteredMessages (updated):", filteredMessages);
  console.log("🚀 ~ Chat ~ selectedUser:", selectedUser?.username);
  console.log("🚀 ~ Chat ~ friendsList:", friendsList);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages]);

  // Helper function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return DeliveredIcon;
      case "seen":
        return ReadIcon;
      default:
        return SentIcon;
    }
  };

  // Helper function to get status text for accessibility
  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Delivered";
      case "seen":
        return "Read";
      default:
        return "Sent";
    }
  };

  // Effect for handling chat focus events
  useEffect(() => {
    const handleFocus = () => {
      if (selectedUser) {
        // Mark messages as seen when chat is focused
        markMessagesAsSeen(selectedUser.id || "");
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedUser, markMessagesAsSeen]);

  return (
    <div className="flex gap-5 p-4 h-screen">
      <div className="flex flex-col gap-3 w-[20%] min-w-[300px] px-2 border-r border-gray-200">
        <input
          type="text"
          placeholder="Search for a friend..."
          className="p-2 border border-gray-300 rounded w-full max-w-md"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearchFriend((e.target as HTMLInputElement).value);
            }
          }}
        />
        <div className="flex flex-col gap-2 border-t border-gray-200">
          <p className="py-2 text-gray-700">
            Friends{" "}
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                {totalUnread}
              </span>
            )}
          </p>
          <ul>
            {friendsList.length > 0 ? (
              friendsList.map((friend: User) => (
                <li
                  key={friend.id}
                  onClick={() => handleSelectUser(friend)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                >
                  <img
                    src={friend.avatar || UserIcon}
                    alt={friend.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <span className="text-gray-800">{friend.username}</span>
                    {friend.isOnline && (
                      <span className="text-green-500 text-sm ml-2">
                        Online
                      </span>
                    )}
                  </div>
                  {unreadCounts[friend.id || ""] && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {unreadCounts[friend.id || ""]}
                    </span>
                  )}
                </li>
              ))
            ) : (
              <li className="p-2 text-gray-500">No friends found</li>
            )}
          </ul>
        </div>

        {/* Search results section */}
        {users.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-200 mt-4">
            <p className="py-2 text-gray-700">Search Results</p>
            <ul>
              {users.map((user: User) => (
                <li
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                >
                  <img
                    src={user.avatar || UserIcon}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="text-gray-800">{user.username}</span>
                  {user.isOnline && (
                    <span className="text-green-500 text-sm">Online</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {selectedUser && (
        <div className="flex-1 flex flex-col justify-between px-4 border-l border-gray-200">
          <h2 className="text-xl font-semibold pb-2">
            Chat with {selectedUser.username}
          </h2>
          {/* Messages display */}
          <div className="flex-1 overflow-y-auto pt-2 border border-gray-200 p-4 rounded-[10px]">
            {isLoadingHistory ? (
              <div className="text-center text-gray-500">
                Loading chat history...
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((msg: message, index: number) => {
                    const isCurrentUser = msg.senderId === currentUserId;
                    return (
                      <li
                        key={index}
                        className={`flex ${
                          isCurrentUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] min-w-[20%] ${
                            isCurrentUser
                              ? "bg-gray-500 text-white rounded-l-lg rounded-tr-lg"
                              : "bg-gray-200 text-gray-800 rounded-r-lg rounded-tl-lg"
                          } px-3 py-[6px]`}
                        >
                          <p className="break-words text-[15px]">
                            {msg.message}
                          </p>
                          <div className="flex justify-end gap-1 items-center">
                            <span
                              className={`text-[10px] ${
                                isCurrentUser
                                  ? "text-blue-100"
                                  : "text-gray-500"
                              } block`}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                            {isCurrentUser && (
                              <img
                                src={getStatusIcon(msg.status)}
                                alt={getStatusText(msg.status)}
                                className="w-2 h-2 mb-[1px]"
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-center text-gray-500">
                    No messages yet. Start the conversation!
                  </li>
                )}
                {/* Auto-scroll reference */}
                <div ref={messagesEndRef} />
              </ul>
            )}
          </div>
          {/* Placeholder for message input */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Type a message..."
              className="w-full p-2 border border-gray-300 rounded"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const message = (e.target as HTMLInputElement).value;
                  if (message.trim()) {
                    handleSendPrivateMessage(selectedUser.id, message);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
