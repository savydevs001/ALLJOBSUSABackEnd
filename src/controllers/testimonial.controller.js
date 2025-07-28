import Testimonial from "../database/models/testimonial.model.js";

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
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.status(200).json({ testimonials });
  } catch (error) {
    res.status(500).json({ message: "Error fetching testimonials", error });
  }
};

const getTestimonialById = async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ testimonial });
  } catch (error) {
    res.status(500).json({ message: "Error fetching testimonial", error });
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
    res
      .status(200)
      .json({ message: "Updated successfully", testimonial: updated });
  } catch (error) {
    res.status(500).json({ message: "Error updating testimonial", error });
  }
};

const deleteTestimonial = async (req, res) => {
  try {
    const deleted = await Testimonial.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting testimonial", error });
  }
};

export {
  createTestimonial,
  getAllTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial,
};
