import { z } from "zod";
import CareerJob from "../database/models/career-job.model.js";
import mongoose from "mongoose";

const createCareerJobZodSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string(),
  salary: z.object({
    min: z.number(),
    max: z.number(),
  }),
  jobType: z.enum(["Part-Time", "Full-Time", "Contract"]),
});

const createCareerJob = async (req, res) => {
  const parsed = createCareerJobZodSchema.parse(req.body);
  try {
    const career = new CareerJob({
      ...parsed,
    });
    await career.save();
    return res.status(201).json({
      message: "Career added succesfully",
      _id: career._id.toString(),
    });
  } catch (err) {
    console.log("Error creating new career: ", err);
    return res
      .status(500)
      .json({ message: "Error creating new career", err: err.message });
  }
};

// get all
const getAllCareerJobs = async (req, res) => {
  try {
    const careers = await CareerJob.find({});
    const tranformed = careers.map((e) => ({
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      jobType: e.jobType,
      location: e.location,
      salary: e.salary,
    }));
    return res.status(200).json({ careers: tranformed });
  } catch (err) {
    console.log("Error getting career jobs: ", err);
    return res.status(500).json({ message: "Error getting careers" });
  }
};

// career by id
const getCareerById = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?._id;
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Not found " });
    }
    let tranformed;
    if (userRole == "admin" || userRole == "manager") {
      const career = await CareerJob.findById(id).populate(
        "applicants.userId",
        "_id email fullName profilePictureUrl"
      );

      if (!career) {
        return res.status(400).json({ message: "Career Not found" });
      }

      tranformed = {
        _id: career._id.toString(),
        title: career.title,
        description: career.description,
        jobType: career.jobType,
        location: career.location,
        salary: career.salary,
        applicants: career.applicants.map((e2) => ({
          _id: e2.userId?._id.toString(),
          fullName: e2.userId?.fullName,
          profilePictureUrl: e2.userId?.profilePictureUrl,
          email: e2.userId?.email,
          role: e2.role == "jobSeeker" ? "job-seeker" : e2.role,
        })),
      };
    } else {
      const career = await CareerJob.findById(id);
      if (!career) {
        return res.status(400).json({ message: "Career Not found" });
      }
      tranformed = {
        _id: career._id.toString(),
        title: career.title,
        description: career.description,
        jobType: career.jobType,
        location: career.location,
        salary: career.salary,
        alreadyApplied: userId
          ? career.applicants.some(
              (e) => e.userId?.toString() === userId?.toString()
            )
          : false,
      };
    }
    return res.status(200).json({ career: tranformed });
  } catch (err) {
    console.log("Error getting career job: ", err);
    return res.status(500).json({ message: "Error getting career" });
  }
};

// edit job
const editCareerJob = async (req, res) => {
  const parsed = createCareerJobZodSchema.parse(req.body);
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Not found " });
  }
  try {
    const career = await CareerJob.findById(id);
    if (!career) {
      return res.status(404).json({ message: "Career Not found" });
    }

    career.title = parsed.title;
    career.location = parsed.location;
    career.salary = parsed.salary;
    career.description = parsed.description;
    career.jobType = parsed.jobType;
    await career.save();

    return res.status(200).json({
      message: "Career edited succesfully",
      _id: career._id.toString(),
    });
  } catch (err) {
    console.log("Error editing career: ", err);
    return res
      .status(500)
      .json({ message: "Error editing career", err: err.message });
  }
};

// delete job
const deleteCareerJob = async (req, res) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid id" });
  }
  try {
    const career = await CareerJob.findByIdAndDelete(id);
    if (!career) {
      return res.status(404).json({ message: "Career Not found" });
    }

    return res.status(200).json({
      message: "Career deleted succesfully",
      _id: career._id.toString(),
    });
  } catch (err) {
    console.log("Error deleting career: ", err);
    return res
      .status(500)
      .json({ message: "Error deleting career", err: err.message });
  }
};

// apply to job
const applyToJob = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Invalid id" });
    }
    const career = await CareerJob.findById(id);
    if (!career) {
      return res.status(404).json({ message: "Career Not found" });
    }

    const applied = (career.applicants || []).some(e => e.userId?.toString() == userId?.toString())
    if(applied){
        return res.status(400).json({message: "You have already aplied for this career"})
    }

    career.applicants = [
      ...(career.applicants || []),
      {
        userId: userId,
        role: userRole == "job-seeker" ? "jobSeeker" : userRole,
        appliedAt: new Date(),
      },
    ];
    await career.save();
    return res.status(200).json({message: "Applied to Job Successfully"})

  } catch (err) {
    console.log("Error Applying for the job: ", err);
    return res
      .status(500)
      .json({ message: "Error applying for the career job", err: err.message });
  }
};

export {
  createCareerJob,
  getAllCareerJobs,
  getCareerById,
  editCareerJob,
  deleteCareerJob,
  applyToJob
};
