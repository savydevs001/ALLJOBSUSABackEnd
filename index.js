import dotenv from "dotenv"
dotenv.config()
import connectToDatabase from "./src/database/index.js";
import app from "./src/app.js";

// Socket IO
import http from "http";
import initSocket from "./src/socket/init-socket.js";


const PORT = process.env.PORT || 8000;
const server = http.createServer(app);

const start = async () => {
  try {
    await connectToDatabase();
    initSocket(server);


    server.listen(PORT, () => {
      console.log(
        `✅ Date: ${new Date()} Server running on http://localhost:${PORT} (PID: ${
          process.pid
        }) `
      );
    });
  } catch (err) {
    console.error("❌ Failed to start server:", error);
    start();
  }
};

start()
