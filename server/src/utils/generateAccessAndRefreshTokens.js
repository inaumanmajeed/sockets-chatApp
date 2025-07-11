import User from "../models/User.model.js";

export const generateAccessAndRefreshTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  // Save the refresh token and access token to the user document
  user.refreshToken = refreshToken;
  user.accessToken = accessToken;
  await user.save({
    validateModifiedOnly: true, // Only validate modified fields
    runValidators: true, // Run validators for the modified fields
  });
  return { accessToken, refreshToken };
};
