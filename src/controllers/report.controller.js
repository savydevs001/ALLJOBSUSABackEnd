import mongoose from "mongoose";
import Report from "../database/models/report.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";

const createReport = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { reportedId, reportedUserRole, comment } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    if (!mongoose.Types.ObjectId.isValid(reportedId)) {
      return res.status(400).json({ message: "Invalid Reported Id" });
    }

    if (!["job-seeker", "employer", "freelancer"].includes(reportedUserRole)) {
      return res.status(400).json({ message: "Invalid Reported user role" });
    }

    if (!comment || comment?.trim() == "") {
      return res.status(400).json({
        message: "Please add deatils of reporting",
        err: "comment field is empty",
      });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    const isAlreadyBlocked = (user.blocked || []).some(
      (e) => e.userId === reportedId
    );
    if (isAlreadyBlocked) {
      return res.status(400).json({ message: "User already blocked" });
    }
    user.blocked = [
      ...(user.blocked || []),
      {
        userId: reportedId,
        at: new Date(),
      },
    ];

    const reportedModel =
      reportedUserRole == "job-seeker" ? "jobSeeker" : reportedUserRole;
    const reporterModel =
      reportedUserRole == "job-seeker" ? "jobSeeker" : reportedUserRole;

    const report = new Report({
      comment,
      reportedId: reportedId,
      reporterId: userId,
      reportedModel: reportedModel,
      reporterModel: reporterModel,
      createdAt: new Date(),
    });

    await report.save();
    await user.save();

    return res.status(200).json("User reported");
  } catch (err) {
    console.log("Error creating a report: ", err);
    return res
      .status(500)
      .json({ message: "Error creating report", err: err.message });
  }
};

export { createReport };
