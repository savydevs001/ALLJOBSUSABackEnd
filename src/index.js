import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import os from "os";
import cluster from "cluster";

// utils
import connectToDatabase from "./database/index.js";
import errorHandlerMiddleware from "./middlewares/errorHandler.middleware.js";
import verifyTokenMiddleware from "./middlewares/verifyToken.middleware.js";

// Routers
import AuthenticationRouter from "./routes/authentication.routes.js";
import UserRouter from "./routes/users.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import FreelancerRouter from "./routes/freelancer.routes.js";
import EmployerRouter from "./routes/employer.routes.js";
import JobRouter from "./routes/jobs.routes.js";
import NotificationRouter from "./routes/notification.routes.js";
import OfferRouter from "./routes/offers.routes.js";
import lastOnlineMiddleware from "./middlewares/lastOnline.middleware.js";
import MessageRouter from "./routes/messages.routes.js";
import ConversationRouter from "./routes/conversation.routes.js";
import reviewRouter from "./routes/reviews.routes.js";
import orderRouter from "./routes/order.routes.js";
import transactionRouter from "./routes/transactions.routes.js";
import { stripeWebhook } from "./services/stripe.service.js";

// Socket IO
import http from "http";
import initSocket from "./socket/init-socket.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const FRONTEND_URL=process.env.FRONTEND_URL
const NODE_ENV = process.env.NODE_ENV || "development";
const numCPUs = os.cpus().length;

// const startServer = async ({ withSocket = false }) => {
try {
  await connectToDatabase();

  const app = express();

  const server = http.createServer(app);
  // if (withSocket) {
  initSocket(server);
  // }

  app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook
  );

  // Middlewares
  app.use(
    cors({
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE"],
      origin: [FRONTEND_URL],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
    app.use(express.static("src/public"));
  app.get(
    "/",
    verifyTokenMiddleware("weak"),
    lastOnlineMiddleware,
    async (req, res) => res.status(200).json({ message: "ok" })
  );

  app.use("/auth", AuthenticationRouter);
  app.use("/users", UserRouter);
  app.use("/freelancers", FreelancerRouter);
  app.use("/employers", verifyTokenMiddleware(), EmployerRouter);
  app.use("/jobs", verifyTokenMiddleware(), JobRouter);
  app.use("/notifications", NotificationRouter);
  app.use("/offers", OfferRouter);
  app.use("/messages", MessageRouter);
  app.use("/conversation", ConversationRouter);
  app.use("/reviews", reviewRouter);
  app.use("/orders", orderRouter);
  app.use("/payments", express.json(), transactionRouter);
  app.use("/upload", uploadRouter);

  // End Middlewares
  app.use(errorHandlerMiddleware);

  server.listen(PORT, () => {
    console.log(
      `✅ Server running on http://localhost:${PORT} (PID: ${process.pid})`
    );
  });
} catch (error) {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
}
// };

// // Production mode: use cluster
// if (NODE_ENV === "production" && cluster.isPrimary) {
//   console.log(`🧠 Master process running (PID: ${process.pid})`);
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on("exit", (worker, code, signal) => {
//     console.warn(`⚠️ Worker ${worker.process.pid} died. Restarting...`);
//     cluster.fork();
//   });
// } else {
//   startServer({ withSocket: true });
// }
