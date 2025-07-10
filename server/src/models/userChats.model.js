import mongoose, { Schema } from "mongoose";

const userChatsSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    messages: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        senderUsername: { type: String, required: true },
        recipientId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        recipientUsername: { type: String, required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ["sent", "delivered", "seen"],
          default: "sent",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const UserChat = mongoose.model("UserChat", userChatsSchema);
export default UserChat;
