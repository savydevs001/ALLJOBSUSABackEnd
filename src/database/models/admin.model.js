import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: {
    hash: { type: String, required: true },
    salt: { type: String, required: true },
  },
});

const ADMIN = mongoose.model("admin", adminSchema);
export default ADMIN;
