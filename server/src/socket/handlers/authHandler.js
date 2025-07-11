import User from "../../models/User.model.js";
import bcrypt from "bcryptjs";
import { generateAccessAndRefreshTokens } from "../../utils/generateAccessAndRefreshTokens.js";
import jwt from "jsonwebtoken";

// Handle user registration
export const handleRegisterUser = (socket) => {
  return async (userData) => {
    console.log("🚀 registerUser event received:", userData);
    console.log("Socket ID:", socket.id);

    const { username, email, password } = userData;
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        socket.emit("registerError", "Username or email already exists");
        return;
      }

      // Create new user
      const newUser = new User({
        username,
        email,
        password, // Password will be hashed by the pre-save middleware
      });

      const savedUser = await newUser.save();
      console.log("✅ User registered successfully:", savedUser.username);

      socket.emit("registerSuccess", {
        message: "User registered successfully",
        user: {
          id: savedUser._id,
          username: savedUser.username,
          email: savedUser.email,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      socket.emit("registerError", `Registration failed: ${error.message}`);
    }
  };
};

// Handle user login
export const handleLoginUser = (socket, io) => {
  return async (loginData) => {
    console.log("🔐 loginUser event received:", loginData);
    const { username, password } = loginData;

    try {
      // Find user by username
      const user = await User.findOne({ username });

      if (!user) {
        socket.emit("loginError", "Invalid username or password");
        return;
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        socket.emit("loginError", "Invalid username or password");
        return;
      }

      // Generate tokens
      const { accessToken, refreshToken } =
        await generateAccessAndRefreshTokens(user._id);

      console.log("✅ User logged in successfully:", user.username);

      socket.emit("loginSuccess", {
        message: "Login successful",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error("Login error:", error);
      socket.emit("loginError", `Login failed: ${error.message}`);
    }
  };
};

// Handle refresh token
export const handleRefreshAccessToken = (socket) => {
  return async (data) => {
    console.log("🔄 refreshAccessToken event received");
    const { refreshToken } = data;

    try {
      if (!refreshToken) {
        socket.emit("refreshError", "Refresh token is required");
        return;
      }

      // Verify refresh token
      const decodedToken = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );

      // Find user and verify refresh token matches
      const user = await User.findById(decodedToken.id);

      if (!user || user.refreshToken !== refreshToken) {
        socket.emit("refreshError", "Invalid refresh token");
        return;
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } =
        await generateAccessAndRefreshTokens(user._id);

      console.log("✅ Access token refreshed for user:", user.username);

      socket.emit("accessTokenRefreshed", {
        message: "Access token refreshed successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Error refreshing access token:", error);
      socket.emit(
        "refreshError",
        `Failed to refresh token. ERROR: ${error.message}`
      );
    }
  };
};
