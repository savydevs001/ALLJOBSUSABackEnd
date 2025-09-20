import mongoose from "mongoose";
import Testimonial from "../database/models/testimonial.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import dotenv from "dotenv";
import { getSupportAdminId } from "./support.controller.js";
import { notifyUser } from "./notification.controller.js";
dotenv.config();

const createTestimonial = async (req, res) => {
  try {
    const { profilePictureUrl, name, status, role, rating, details } = req.body;

    // Basic validation
    if (!name || !role || !rating || !details) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    const newTestimonial = await Testimonial.create({
      profilePictureUrl,
      name,
      status: status || "draft",
      role,
      rating,
      details,
    });

    return res.status(201).json({
      message: "Testimonial created successfully.",
      testimonial: newTestimonial,
    });
  } catch (error) {
    console.error("Error creating testimonial:", error);
    return res
      .status(500)
      .json({ message: "Server error while creating testimonial." });
  }
};

const getAllTestimonials = async (req, res) => {
  try {
    let filter = { status: "published" };
    if (req.user && ["admin", "manager"].includes(req.user?.role)) {
      filter = {};
    }

    // if admin send all, otherwise send published only
    const testimonials = await Testimonial.find(filter).sort({
      createdAt: -1,
    });
    return res.status(200).json({ testimonials });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching testimonials", error });
  }
};

const getTestimonialById = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ testimonial });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching testimonial", error });
  }
};

const updateTestimonial = async (req, res) => {
  try {
    const updated = await Testimonial.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    return res
      .status(200)
      .json({ message: "Updated successfully", testimonial: updated });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating testimonial", error });
  }
};

const deleteTestimonial = async (req, res) => {
  try {
    const deleted = await Testimonial.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting testimonial", error });
  }
};

// create by user
const userCreateTestimonial = async (req, res) => {
  try {
    const { rating, details } = req.body;
    const userId = req.user?._id;
    const role = req.user?.role;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    // Basic validation
    if (!rating || !details) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    if (!(rating >= 0 && rating <= 5)) {
      return res.status(400).json({ message: "Invalid rating value" });
    }

    const isAlreadyCreated = await Testimonial.countDocuments({
      createdBy: userId,
    });

    if (isAlreadyCreated > 0) {
      return res.status(400).json({
        message: "You have already submittied your experience with us",
      });
    }

    let user;
    switch (role) {
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (user.status !== "active") {
      return res
        .status(200)
        .json({ message: "Only Active user can submit rate us" });
    }

    const newTestimonial = await Testimonial.create({
      profilePictureUrl: user.profilePictureUrl,
      name: user.fullName,
      status: "draft",
      role: role == "job-seeker" ? "jobSeeker" : role,
      rating,
      details,
      createdBy: user._id,
    });

    try {
      const adminId = await getSupportAdminId();
      notifyUser({
        from: user.fullName,
        title: `New Testimonial`,
        ctaUrl: `admin/testimonial`,
        message: `User: ${user.fullName + " - " + user._id.toString()
          } has sent a testimonial/feeback`,
        userId: adminId,
        userMail: process.env.SUPPORT_RECIEVE_EMAIL,
        fcm_token: null
      });
    } catch (err) {
      // do nothing here
      console.log(
        "Error sending notification on new testimonial creation: " + err
      );
    }

    return res.status(201).json({
      message: "Testimonial created successfully.",
      testimonial: newTestimonial,
    });
  } catch (error) {
    console.error("Error creating testimonial:", error);
    return res.status(500).json({
      message: "Server error while creating testimonial.",
      err: err.messageF,
    });
  }
};

export {
  createTestimonial,
  getAllTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial,
  userCreateTestimonial,
};
