import User from "../database/models/users.model.js";

const uploadProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `${req.newName.replace(/\\/g, "/")}`;

  const userId = req.user?._id;
  if (userId) {
    await User.findByIdAndUpdate(userId, {
      profile: {
        profilePictureUrl: fileUrl,
      },
    });
  }

  return res.status(200).json({
    message: "Upload successful",
    url: fileUrl,
  });
};

const uploadResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const fileUrl = `${req.newName.replace(/\\/g, "/")}`;

  const userId = req.user?._id;
  if (userId) {
    const user = await User.findOneAndUpdate(
      { _id: userId, status: "active", role: { $in: ["freelancer"] } },
      {
        freelancerDetails: {
          resumeUrl: fileUrl,
        },
      },
    );

    if(!user){
      console.log("❌ Error uploading resume: ", err)
      return res.status(500).json({message: "Server Error"})
    }
  }

  return res.status(200).json({
    message: "Upload successful",
    url: fileUrl,
  });
};

export { uploadProfilePicture, uploadResume };
