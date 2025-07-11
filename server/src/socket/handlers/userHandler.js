import User from "../../models/User.model.js";
import UserChat from "../../models/userChats.model.js";

// Handle searching users by username
export const handleSearchUsers = (socket) => {
  return async (searchData) => {
    try {
      let query = {};
      let projection = { password: 0, refreshToken: 0, accessToken: 0 };

      // If search term is provided, create a case-insensitive regex search
      if (searchData && searchData.username && searchData.username.trim()) {
        const searchTerm = searchData.username.trim();

        query = {
          username: { $regex: searchTerm, $options: "i" },
        };
        console.log("🔍 Searching for username containing:", searchTerm);
      } else {
        console.log("🔍 Fetching all users");
      }

      const users = await User.find(query, projection).limit(50);
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
  };
};

// Handle getting friends list
export const handleGetFriendsList = (socket) => {
  return async () => {
    try {
      // Find the user and populate the friends list
      const userWithFriends = await User.findById(socket.user._id)
        .populate("friends", "username email isOnline socketId")
        .exec();

      if (!userWithFriends) {
        socket.emit("friendsListError", "User not found");
        return;
      }

      // Format friends list with proper data
      const friendsList = userWithFriends.friends.map((friend) => ({
        id: friend._id,
        username: friend.username,
        email: friend.email,
        isOnline: friend.isOnline || false,
        socketId: friend.socketId,
      }));

      socket.emit("friendsListSuccess", { friends: friendsList });
    } catch (error) {
      console.error("Error fetching friends list:", error);
      socket.emit(
        "friendsListError",
        `Failed to fetch friends list. ERROR: ${error.message}`
      );
    }
  };
};

// Handle getting unread message count
export const handleGetUnreadCount = (socket) => {
  return async () => {
    try {
      // Get the user's unread messages count
      const user = await User.findById(socket.user._id);
      const totalUnread = user.getUnreadCount();

      // Find all chats where this user has unread messages for detailed breakdown
      const unreadChats = await UserChat.find({
        participants: socket.user._id,
        "messages.recipientId": socket.user._id,
        "messages.status": { $in: ["sent", "delivered"] },
      });

      const unreadByUser = {};

      unreadChats.forEach((chat) => {
        let unreadInThisChat = 0;
        let otherParticipant = null;

        // Find the other participant
        otherParticipant = chat.participants.find(
          (p) => p.toString() !== socket.user._id.toString()
        );

        chat.messages.forEach((message) => {
          if (
            message.recipientId.toString() === socket.user._id.toString() &&
            (message.status === "sent" || message.status === "delivered")
          ) {
            unreadInThisChat++;
          }
        });

        if (unreadInThisChat > 0 && otherParticipant) {
          unreadByUser[otherParticipant.toString()] = unreadInThisChat;
        }
      });

      socket.emit("unreadCountSuccess", {
        totalUnread,
        unreadByUser,
      });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      socket.emit(
        "unreadCountError",
        `Failed to fetch unread count. ERROR: ${error.message}`
      );
    }
  };
};
