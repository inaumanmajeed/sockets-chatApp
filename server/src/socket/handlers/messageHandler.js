import User from "../../models/User.model.js";
import UserChat from "../../models/userChats.model.js";

// Handle sending private messages
export const handleSendPrivateMessage = (socket, io) => {
  return async (messageData) => {
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

      // Check if recipient is in user's friends list if not then add them
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
      const participants = [socket.user._id, recipient._id].sort();

      let userChat = await UserChat.findOne({
        participants: { $all: participants, $size: 2 },
      });

      if (!userChat) {
        userChat = new UserChat({
          participants: participants,
          messages: [messageDataToSend],
        });
      } else {
        userChat.messages.push(messageDataToSend);
      }

      await userChat.save();

      // Get the saved message with its ID
      const savedMessage = userChat.messages[userChat.messages.length - 1];
      console.log("🚀 ~ savedMessage:", savedMessage);

      // Check if recipient is online and emit message - AUTO DELIVERY
      let finalStatus = "sent";
      if (recipient.socketId && recipient.isOnline) {
        // Recipient is online, message will be automatically delivered
        finalStatus = "delivered";
        savedMessage.status = "delivered";
        await userChat.save();

        // Add to recipient's unread messages
        await recipient.addUnreadMessage(savedMessage._id);

        io.to(recipient.socketId).emit("privateMessageReceived", {
          ...messageDataToSend,
          _id: savedMessage._id,
          status: "delivered",
        });

        // Notify sender about delivery
        socket.emit("messageStatusUpdated", {
          chatId: userChat._id,
          messageId: savedMessage._id,
          status: "delivered",
          updatedMessage: savedMessage,
        });
      }

      console.log("📩 Message sent to recipient:", recipient.username);

      // Acknowledge message sent
      socket.emit("sendMessageSuccess", {
        message: "Message sent successfully",
        recipient: {
          id: recipient._id,
          username: recipient.username,
        },
        messageData: {
          ...messageDataToSend,
          _id: savedMessage._id,
          status: finalStatus,
        },
      });
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit(
        "sendMessageError",
        `Failed to send message. ERROR: ${error.message}`
      );
    }
  };
};

// Handle getting chat history
export const handleGetChatHistory = (socket) => {
  return async (data) => {
    console.log("🔍 Get chat history request:", data);
    const { userId } = data;

    try {
      if (!userId) {
        socket.emit("getChatHistoryError", "User ID is required");
        return;
      }

      // Find chat between current user and requested user
      const participants = [socket.user._id, userId].sort();

      const userChat = await UserChat.findOne({
        participants: { $all: participants, $size: 2 },
      }).populate("participants", "username email");

      if (!userChat) {
        socket.emit("getChatHistorySuccess", {
          messages: [],
          participants: participants,
          count: 0,
        });
        return;
      }

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
  };
};

// Handle marking messages as seen
export const handleMarkMessagesAsSeen = (socket, io) => {
  return async (data) => {
    console.log("👁️ Mark messages as seen request:", data);
    const { chatPartnerId } = data;

    try {
      if (!chatPartnerId) {
        socket.emit("markMessagesAsSeenError", "Chat partner ID is required");
        return;
      }

      // Find chat between current user and chat partner
      const participants = [socket.user._id, chatPartnerId].sort();

      const userChat = await UserChat.findOne({
        participants: { $all: participants, $size: 2 },
      });

      if (!userChat) {
        socket.emit("markMessagesAsSeenError", "Chat not found");
        return;
      }

      // Mark all messages from chat partner as seen
      let updatedCount = 0;
      const seenMessageIds = [];

      userChat.messages.forEach((message) => {
        if (
          message.senderId.toString() === chatPartnerId &&
          message.recipientId.toString() === socket.user._id.toString() &&
          message.status !== "seen"
        ) {
          message.status = "seen";
          seenMessageIds.push(message._id);
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await userChat.save();

        // Remove seen messages from unread messages
        for (const messageId of seenMessageIds) {
          await socket.user.removeUnreadMessage(messageId);
        }

        // Notify the sender about messages being seen
        const chatPartner = await User.findById(chatPartnerId);
        if (chatPartner && chatPartner.socketId && chatPartner.isOnline) {
          io.to(chatPartner.socketId).emit("messagesMarkedAsSeen", {
            chatId: userChat._id,
            seenBy: socket.user._id,
            seenByUsername: socket.user.username,
            count: updatedCount,
          });
        }

        console.log(`👁️ Marked ${updatedCount} messages as seen`);
      }

      socket.emit("markMessagesAsSeenSuccess", {
        message: "Messages marked as seen",
        count: updatedCount,
      });
    } catch (error) {
      console.error("Error marking messages as seen:", error);
      socket.emit(
        "markMessagesAsSeenError",
        `Failed to mark messages as seen. ERROR: ${error.message}`
      );
    }
  };
};

// Handle updating message status (kept for backward compatibility)
export const handleUpdateMessageStatus = (socket, io) => {
  return async (data) => {
    console.log("🔄 Update message status request:", data);
    const { messageId, status, chatPartnerId } = data;

    try {
      if (!messageId || !status) {
        socket.emit(
          "updateMessageStatusError",
          "Message ID and status are required"
        );
        return;
      }

      // Validate status
      const validStatuses = ["sent", "delivered", "seen"];
      if (!validStatuses.includes(status)) {
        socket.emit("updateMessageStatusError", "Invalid status provided");
        return;
      }

      // Find chat containing the message
      const participants = chatPartnerId
        ? [socket.user._id, chatPartnerId].sort()
        : null;

      let userChat;
      if (participants) {
        userChat = await UserChat.findOne({
          participants: { $all: participants, $size: 2 },
          "messages._id": messageId,
        });
      } else {
        userChat = await UserChat.findOne({
          "messages._id": messageId,
        });
      }

      if (!userChat) {
        socket.emit("updateMessageStatusError", "Chat or message not found");
        return;
      }

      // Find and update the specific message
      const message = userChat.messages.id(messageId);
      if (!message) {
        socket.emit("updateMessageStatusError", "Message not found");
        return;
      }

      // Update message status
      const oldStatus = message.status;
      message.status = status;
      await userChat.save();

      // Handle unread messages tracking
      if (status === "seen" && oldStatus !== "seen") {
        await socket.user.removeUnreadMessage(messageId);
      }

      console.log(
        `✅ Message status updated: ${messageId} from ${oldStatus} to ${status}`
      );

      // Notify all participants about the status change
      userChat.participants.forEach(async (participantId) => {
        const participant = await User.findById(participantId);
        if (participant && participant.socketId && participant.isOnline) {
          io.to(participant.socketId).emit("messageStatusUpdated", {
            chatId: userChat._id,
            messageId: message._id,
            status: status,
            updatedBy: socket.user._id,
            updatedMessage: message,
          });
        }
      });

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
  };
};
