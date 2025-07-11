// Helper function to get current time in Pakistan Standard Time
export const getPakistanTime = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Karachi",
  });
};