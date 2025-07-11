import { connectedUsers } from "../middleware/authMiddleware.js";
import { getPakistanTime } from "../utils/timezone.js";

// Handle new socket connection
export const handleConnection = (socket) => {
  console.log("A user connected:", socket.id);
};

// Handle socket disconnection
// This function will be called when a user disconnects
// It updates the user's status to offline and saves the last seen time
// and remove the user from connectedUsers map
export const handleDisconnection = (socket, io) => {
  return () => {
    console.log("User disconnected:", socket.id);
    connectedUsers.delete(socket.id);

    if (socket.user) {
      // Update user status to offline and last seen time in a single operation
      socket.user.isOnline = false;
      socket.user.socketId = "";
      socket.user.lastSeen = new Date(getPakistanTime());

      socket.user
        .save()
        .then((updatedUser) => {
          console.log(
            "😴 User status updated to offline:",
            updatedUser.username,
            "Last seen:",
            updatedUser.lastSeen.toLocaleTimeString()
          );
        })
        .catch((error) => {
          console.error("Error updating user status:", error);
        });
    }

    io.emit("connectedUsers", Array.from(connectedUsers.values()));
  };
};
