import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPakistanTime } from "../socket/utils/timezone.js";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    lastSeen: { type: Date, default: () => new Date(getPakistanTime()) },
    profilePicture: { type: String, default: "" },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String, default: "" }, // Store socket ID for real-time updates
    friends: [{ type: Schema.Types.ObjectId, ref: "User" }], // Array of friend IDs
    groups: [{ type: Schema.Types.ObjectId, ref: "Group" }], // Array of group IDs
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    unreadMessages: [{ type: Schema.Types.ObjectId, ref: "UserChat" }], // Array of message IDs that are unread
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret.password;
        delete ret.__v;
        delete ret.refreshToken;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT access token
userSchema.methods.generateAccessToken = function () {
  const payload = { id: this._id, username: this.username };
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const options = { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION };
  this.accessToken = jwt.sign(payload, secret, options);
  return this.accessToken;
};

// Method to generate JWT refresh token
userSchema.methods.generateRefreshToken = function () {
  const payload = { id: this._id, username: this.username };
  const secret = process.env.REFRESH_TOKEN_SECRET;
  const options = { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION };
  this.refreshToken = jwt.sign(payload, secret, options);
  return this.refreshToken;
};

// Method to add a friend
userSchema.methods.addFriend = function (friendId) {
  if (!this.friends.includes(friendId)) {
    this.friends.push(friendId);
  }
  return this.save();
};

// Method to remove a friend
userSchema.methods.removeFriend = function (friendId) {
  this.friends = this.friends.filter(
    (id) => id.toString() !== friendId.toString()
  );
  return this.save();
};

// Method to add a group
userSchema.methods.addGroup = function (groupId) {
  if (!this.groups.includes(groupId)) {
    this.groups.push(groupId);
  }
  return this.save();
};

// Method to remove a group
userSchema.methods.removeGroup = function (groupId) {
  // Check if the group exists before removing
  if (!this.groups.includes(groupId)) {
    console.log(`Group ID ${groupId} not found in user's groups.`);
    return this; // No changes made, return the user object
  }
  // check if user is part of the group then don't allow removal
  if (this.groups.length > 0) {
    console.log(`Users available in  group ${groupId}, cannot remove.`);
    return this; // No changes made, return the user object
  }
  this.groups = this.groups.filter(
    (id) => id.toString() !== groupId.toString()
  );
  return this.save();
};

// Method to add unread message
userSchema.methods.addUnreadMessage = function (messageId) {
  if (!this.unreadMessages.includes(messageId)) {
    this.unreadMessages.push(messageId);
  }
  return this.save();
};

// Method to remove unread message
userSchema.methods.removeUnreadMessage = function (messageId) {
  this.unreadMessages = this.unreadMessages.filter(
    (id) => id.toString() !== messageId.toString()
  );
  return this.save();
};

// Method to clear all unread messages
userSchema.methods.clearUnreadMessages = function () {
  this.unreadMessages = [];
  return this.save();
};

// Method to get unread messages count
userSchema.methods.getUnreadCount = function () {
  return this.unreadMessages.length;
};

const User = mongoose.model("User", userSchema);
export default User;
