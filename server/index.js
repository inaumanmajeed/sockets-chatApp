import "dotenv/config";
import { createServer } from "http";
import { app } from "./app.js";
import { connectDB } from "./src/db/connectDB.js";
import { PORT } from "./src/constants/index.js";
import { initializeSocketIO } from "./src/socket/socket.js";

const server = createServer(app);
const io = initializeSocketIO(server);
app.set("io", io);

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`📡🟢 Server is running on port ${PORT}`);
      console.log(`🌐🟢 Socket.IO server initialized`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
    process.exit(1);
  });
