import dotenv from "dotenv";
dotenv.config();
import connectToDatabase from "./src/database/index.js";
import app from "./src/app.js";

// Socket IO
import http from "http";
import initSocket from "./src/socket/init-socket.js";

// Cron
import cron from "node-cron"
import { runScheduledPayouts } from "./src/controllers/pendingPayout-controller.js";

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

      // Schedule

      cron.schedule("* 3 * * *", async () => { // daily at 3A.M
        try {
          console.log(`Starting Payouts`);
          await runScheduledPayouts();
          console.log(`✅ All Payout Done for ${new Date()}`);
        } catch (err) {
          console.log("❌ Error running all payouts: ", err);
        }
      });

    });
  } catch (err) {
    console.error("❌ Failed to start server:", error);
    start();
  }
};

start();
