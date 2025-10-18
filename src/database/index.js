import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB via Mongoose");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    connectToDatabase()
  }
};

export default connectToDatabase;
