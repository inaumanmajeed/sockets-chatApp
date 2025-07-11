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
