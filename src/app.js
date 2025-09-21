import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
dotenv.config();

// utils
import errorHandlerMiddleware from "./middlewares/errorHandler.middleware.js";
import verifyTokenMiddleware from "./middlewares/verifyToken.middleware.js";

// Routers
import AuthenticationRouter from "./routes/authentication.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import FreelancerRouter from "./routes/freelancer.routes.js";
import EmployerRouter from "./routes/employer.routes.js";
import JobRouter from "./routes/jobs.routes.js";
import NotificationRouter from "./routes/notification.routes.js";
import OfferRouter from "./routes/offers.routes.js";
import MessageRouter from "./routes/messages.routes.js";
import reviewRouter from "./routes/reviews.routes.js";
import orderRouter from "./routes/order.routes.js";
import transactionRouter from "./routes/transactions.routes.js";
import SubscriptionRouter from "./routes/subscription.routes.js";
import AdminRouter from "./routes/admin.routes.js";
import StripeRouter from "./routes/stripe.routes.js";
import JobSeekerRouter from "./routes/job-seeker.routes.js";
import PlateformRouter from "./routes/plateform.routes.js";
import TestimonialRouter from "./routes/testimonial.routes.js";
import LegalContentRouter from "./routes/legalContent.routes.js";
import ContactRouter from "./routes/contact.route.js";
import ApplicationRouter from "./routes/applications.routes.js";
import SupportRouter from "./routes/support.routes.js";
import ManagerRouter from "./routes/manager.routes.js";
import ChatBotRouter from "./routes/chatbot.routes.js";
import TrendinJobRouter from "./routes/trending-job-route.js";
import ReportRouter from "./routes/report.routes.js";
import MeetingRouter from "./routes/meeting.routes.js";
import CareerJobRouter from "./routes/career-job.routes.js";
import ProductReleaseRouter from "./routes/product-releases.routes.js";
import EventRouter from "./routes/events.routes.js";
import GalleryRouter from "./routes/gallery.routes.js";

// stripe
import { stripeWebhook } from "./services/stripe.service.js";

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

const apiRouter = express.Router();

apiRouter.use("/auth", AuthenticationRouter);
apiRouter.use("/freelancers", FreelancerRouter);
apiRouter.use("/employers", EmployerRouter);
apiRouter.use("/job-seekers", JobSeekerRouter);
apiRouter.use("/jobs", verifyTokenMiddleware(), JobRouter);
apiRouter.use("/notifications", NotificationRouter);
apiRouter.use("/offers", OfferRouter);
apiRouter.use("/applications", ApplicationRouter);
apiRouter.use("/messages", MessageRouter);
apiRouter.use("/reports", ReportRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/payments", express.json(), transactionRouter);
apiRouter.use("/subscriptions", SubscriptionRouter);
apiRouter.use("/testimonials", TestimonialRouter);
apiRouter.use("/trending-jobs", TrendinJobRouter);
apiRouter.use("/upload", uploadRouter);
apiRouter.use("/stripe", StripeRouter);
apiRouter.use("/support", SupportRouter);
apiRouter.use("/legal", LegalContentRouter);
apiRouter.use("/contact", ContactRouter);
apiRouter.use("/chatbot", ChatBotRouter);
apiRouter.use("/meetings", MeetingRouter);
apiRouter.use("/careers", CareerJobRouter);
apiRouter.use("/product-releases", ProductReleaseRouter);
apiRouter.use("/events", EventRouter);
apiRouter.use("/gallery", GalleryRouter);

// admin routes
apiRouter.use("/manager", ManagerRouter);
apiRouter.use("/admin", AdminRouter);
apiRouter.use("/plateform", PlateformRouter);

// download file
apiRouter.get("/download", (req, res) => {
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

apiRouter.use("/", (req, res) => res.send("Hello world"));
app.use("/api", apiRouter);

// End Middlewares
app.use(errorHandlerMiddleware);

//for front end
app.use(express.static(path.resolve(process.cwd(), "dist")));

// Fallback only for non-API GET requests
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.resolve(process.cwd(), "dist", "index.html"));
});

export default app;
