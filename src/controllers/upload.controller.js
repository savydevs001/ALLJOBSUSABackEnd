import dotenv from "dotenv";
dotenv.config();

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileUrl = process.env.BACKEND_URL + `/${req.newName}`;
    return res
      .status(200)
      .json({ message: "File uploaded successfully!", url: fileUrl });
  } catch (err) {
    console.log("❌ Error uploading file", err);
    return res.status(500).json({ message: err.message });
  }
};

export { uploadFile };
