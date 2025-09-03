import TRENDING_JOB from "../database/models/trending-job.model.js";

let memoryTrendingJobs;

const createTrendingJob = async (req, res) => {
  try {
    const { title, company, location, minSalary, maxSalary, salaryInterval } =
      req.body;

    // Basic validation
    if (
      !title ||
      !company ||
      !location ||
      !minSalary ||
      !maxSalary ||
      !salaryInterval
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided." });
    }

    if (!["hourly", "weekly", "monthly", "yearly"].includes(salaryInterval)) {
      return res
        .status(400)
        .json({ message: "Invalid value for salary interval" });
    }

    await TRENDING_JOB.create({
      title,
      company,
      location,
      minSalary: Number(minSalary),
      maxSalary: Number(maxSalary),
      salaryInterval: salaryInterval,
    });

    return res.status(201).json({
      message: "Trending job created successfully.",
    });
  } catch (err) {
    console.error("Error creating trending job:", err);
    return res.status(500).json({
      message: "Server error while creating trending job.",
      err: err.message,
    });
  }
};

const getAllTrendingJobs = async (req, res) => {
  try {
    if (memoryTrendingJobs) {
      return res.status(200).json({ jobs: memoryTrendingJobs });
    }
    const data = await TRENDING_JOB.find().sort({
      createdAt: -1,
    });
    memoryTrendingJobs = data;
    return res.status(200).json({ jobs: data });
  } catch (error) {
    console.log("Error fetching trending jobs: ", error);
    return res
      .status(500)
      .json({ message: "Error fetching trending jobs", err: error.message });
  }
};

const updateTrendingJOb = async (req, res) => {
  try {
    const updated = await TRENDING_JOB.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    memoryTrendingJobs = null;
    return res.status(200).json({ message: "Updated successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating trending job", error });
  }
};

const deleteTrendingjob = async (req, res) => {
  try {
    const deleted = await TRENDING_JOB.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    memoryTrendingJobs = null;
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting trending job", error });
  }
};

export {
  createTrendingJob,
  getAllTrendingJobs,
  updateTrendingJOb,
  deleteTrendingjob,
};
