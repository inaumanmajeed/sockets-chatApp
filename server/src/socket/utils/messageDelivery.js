import User from "../../models/User.model.js";
import UserChat from "../../models/userChats.model.js";

// Automatically mark all pending messages as delivered when user comes online
export const autoMarkMessagesAsDelivered = async (userId, socketId, io) => {
  try {
    // Add a small delay to ensure frontend socket listeners are set up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find all chats where this user is a participant
    const userChats = await UserChat.find({
      participants: userId,
      "messages.recipientId": userId,
      "messages.status": "sent",
    });

    let totalUpdated = 0;

    for (const chat of userChats) {
      let chatUpdated = false;
      const updatedMessages = [];

      // Update messages that are sent to this user and still have "sent" status
      chat.messages.forEach((message) => {
        if (
          message.recipientId.toString() === userId.toString() &&
          message.status === "sent"
        ) {
          message.status = "delivered";
          chatUpdated = true;
          totalUpdated++;
          updatedMessages.push(message);
        }
      });

      // Save the chat if any messages were updated
      if (chatUpdated) {
        await chat.save();

        // Notify senders about delivery updates
        const notificationPromises = [];

        for (const participantId of chat.participants) {
          if (participantId.toString() !== userId.toString()) {
            notificationPromises.push(
              User.findById(participantId).then((sender) => {
                if (sender && sender.socketId && sender.isOnline) {
                  // Send individual message updates
                  updatedMessages.forEach((message) => {
                    io.to(sender.socketId).emit("messageStatusUpdated", {
                      chatId: chat._id,
                      messageId: message._id.toString(),
                      status: "delivered",
                      updatedBy: userId,
                      updatedMessage: {
                        _id: message._id.toString(),
                        senderId: message.senderId,
                        recipientId: message.recipientId,
                        senderUsername: message.senderUsername,
                        recipientUsername: message.recipientUsername,
                        message: message.message,
                        status: "delivered",
                        timestamp: message.timestamp,
                      },
                    });
                  });
                }
              })
            );
          }
        }

        await Promise.all(notificationPromises);

        // Also emit updates to the current user immediately
        updatedMessages.forEach((message) => {
          io.to(socketId).emit("messageStatusUpdated", {
            chatId: chat._id,
            messageId: message._id.toString(),
            status: "delivered",
            updatedBy: userId,
            updatedMessage: {
              _id: message._id.toString(),
              senderId: message.senderId,
              recipientId: message.recipientId,
              senderUsername: message.senderUsername,
              recipientUsername: message.recipientUsername,
              message: message.message,
              status: "delivered",
              timestamp: message.timestamp,
            },
          });
        });
      }
    }

    if (totalUpdated > 0) {
      console.log(`✅ Auto-marked ${totalUpdated} messages as delivered`);

      // Emit batch delivery notification to user
      io.to(socketId).emit("batchDeliveryUpdate", {
        count: totalUpdated,
        userId: userId,
        message: `${totalUpdated} messages automatically marked as delivered`,
      });
    }
  } catch (error) {
    console.error("Error auto-marking pending messages as delivered:", error);
  }
};

// Mark a single message as delivered when sent to online user
export const markMessageAsDelivered = async (messageId, chatId, io) => {
  try {
    const userChat = await UserChat.findById(chatId);
    if (!userChat) return;

    const message = userChat.messages.id(messageId);
    if (!message || message.status !== "sent") return;

    message.status = "delivered";
    await userChat.save();

    // Notify all participants about the status change
    userChat.participants.forEach(async (participantId) => {
      const participant = await User.findById(participantId);
      if (participant && participant.socketId && participant.isOnline) {
        io.to(participant.socketId).emit("messageStatusUpdated", {
          chatId: userChat._id,
          messageId: message._id,
          status: "delivered",
          updatedMessage: message,
        });
      }
    });

    console.log(`✅ Message ${messageId} marked as delivered`);
  } catch (error) {
    console.error("Error marking message as delivered:", error);
  }
};
