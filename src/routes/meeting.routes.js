import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  cancelMeeting,
  completeMeeting,
  createMeeting,
  emptyMeeting,
  generateMeetingJwtById,
  meetingById,
  rejectMeeting,
} from "../controllers/meeting.controller.js";

const MeetingRouter = Router();

MeetingRouter.get(
  "/:id/start",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(generateMeetingJwtById)
);
MeetingRouter.get(
  "/:id/completed",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(completeMeeting)
);
MeetingRouter.get(
  "/:id/empty",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(emptyMeeting)
);
MeetingRouter.get(
  "/:id/cancel",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(cancelMeeting)
);
MeetingRouter.get(
  "/:id/reject",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(rejectMeeting)
);
MeetingRouter.get("/:id/overview", a(meetingById));

MeetingRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer", "employer"]),
  a(createMeeting)
);

export default MeetingRouter;
