import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import os from "os";
import path from "path";
import fs from "fs";

// utils
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
import MessageRouter from "./routes/messages.routes.js";
import ConversationRouter from "./routes/conversation.routes.js";
import reviewRouter from "./routes/reviews.routes.js";
import orderRouter from "./routes/order.routes.js";
import transactionRouter from "./routes/transactions.routes.js";
import SubscriptionRouter from "./routes/subscription.routes.js";
import AdminRouter from "./routes/admin.routes.js";

// stripe
import { stripeWebhook } from "./services/stripe.service.js";
import StripeRouter from "./routes/stripe.routes.js";
import JobSeekerRouter from "./routes/job-seeker.routes.js";
import PlateformRouter from "./routes/plateform.routes.js";
import TestimonialRouter from "./routes/testimonial.routes.js";
import LegalContentRouter from "./routes/legalContent.routes.js";
import ContactRouter from "./routes/contact.route.js";
import ApplicationRouter from "./routes/applications.routes.js";
import SupportRouter from "./routes/support.routes.js";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;
const PUBLIC_PATH = path.join(process.cwd(), "src/public");
const app = express();

// Stripe webhook
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

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

app.get("/", (req, res) => res.send("Hello world"));
app.use("/auth", AuthenticationRouter);
app.use("/users", UserRouter);
app.use("/freelancers", FreelancerRouter);
app.use("/employers", EmployerRouter);
app.use("/job-seekers", JobSeekerRouter);
app.use("/jobs", verifyTokenMiddleware(), JobRouter);
app.use("/notifications", NotificationRouter);
app.use("/offers", OfferRouter);
app.use("/applications", ApplicationRouter);
app.use("/messages", MessageRouter);
app.use("/conversation", ConversationRouter);
app.use("/reviews", reviewRouter);
app.use("/orders", orderRouter);
app.use("/payments", express.json(), transactionRouter);
app.use("/subscriptions", SubscriptionRouter);
app.use("/testimonials", TestimonialRouter);
app.use("/upload", uploadRouter);
app.use("/stripe", StripeRouter);
app.use("/support", SupportRouter);
app.use("/legal", LegalContentRouter);
app.use("/contact", ContactRouter);

// admin routes
app.use("/admin", AdminRouter);
app.use("/plateform", PlateformRouter);

// download file
app.get("/download", (req, res) => {
  const fileUrl = req.query?.fileurl;
  const fileName = req.query?.filename;
  if (!fileUrl) {
    return res.status(404).json({ message: "No File url" });
  }
  if (!fileName) {
    return res.status(404).json({ message: "No File name" });
  }
  const splittedUrl = fileUrl.split(BACKEND_URL);
  if (splittedUrl.length < 2) {
    return res.status(400).json({ message: "Invalid File url" });
  }
  const filePath = path.join(PUBLIC_PATH, splittedUrl[1]);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error("Download error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error downloading file");
      }
    }
  });
});

// End Middlewares
app.use(errorHandlerMiddleware);

export default app;
