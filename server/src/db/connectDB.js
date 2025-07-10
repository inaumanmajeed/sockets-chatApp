import mongoose from "mongoose";
import { MONGO_DB_NAME, MONGO_DB_URL } from "../constants/index.js";

export const connectDB = async () => {
  try {
    const db = await mongoose.connect(`${MONGO_DB_URL}/${MONGO_DB_NAME}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`🍃🟢 MongoDB connected: ${db.connection.host}`);
  } catch (error) {
    console.error(`🍃🔴 Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
