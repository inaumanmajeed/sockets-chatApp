import User from "../../models/User.model.js";
import { connectedUsers } from "../middleware/authMiddleware.js";

export const handleConnection = (socket, io) => {
  console.log("A user connected:", socket.id);
};

export const handleDisconnection = (socket, io) => {
  return () => {
    console.log("User disconnected:", socket.id);
    connectedUsers.delete(socket.id);

    if (socket.user) {
      // Update user status to offline
      User.findByIdAndUpdate(
        socket.user._id,
        { isOnline: false, socketId: null },
        { new: true, runValidators: true }
      )
        .then((updatedUser) => {
          console.log(
            "😴 User status updated to offline:",
            updatedUser.username
          );
        })
        .catch((error) => {
          console.error("Error updating user status:", error);
        });
    }

    io.emit("connectedUsers", Array.from(connectedUsers.values()));
  };
};
