import dotenv from "dotenv"
dotenv.config()

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileUrl =  process.env.BACKEND_URL + `/${req.newName}`;
    return res
      .status(200)
      .json({ message: "File uploaded successfully!", url: fileUrl });
  } catch (err) {
    console.log("❌ Error uploading file", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// const uploadProfilePicture = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "No file uploaded" });
//   }
//   const fileUrl = `${req.newName.replace(/\\/g, "/")}`;

//   const userId = req.user?._id;
//   if (userId) {
//     await User.findByIdAndUpdate(userId, {
//       profile: {
//         profilePictureUrl: fileUrl,
//       },
//     });
//   }

//   return res.status(200).json({
//     message: "Upload successful",
//     url: fileUrl,
//   });
// };

// const uploadResume = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "No file uploaded" });
//   }
//   const fileUrl = `${req.newName.replace(/\\/g, "/")}`;

//   const userId = req.user?._id;
//   if (userId) {
//     const user = await User.findOneAndUpdate(
//       { _id: userId, status: "active", role: { $in: ["freelancer"] } },
//       {
//         freelancerDetails: {
//           resumeUrl: fileUrl,
//         },
//       },
//     );

//     if(!user){
//       console.log("❌ Error uploading resume: ", err)
//       return res.status(500).json({message: "Server Error"})
//     }
//   }

//   return res.status(200).json({
//     message: "Upload successful",
//     url: fileUrl,
//   });
// };

export {
  uploadFile,
  // uploadProfilePicture, uploadResume
};
