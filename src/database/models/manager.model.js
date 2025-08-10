import mongoose from "mongoose";

const managerSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: {
    hash: { type: String, required: true },
    salt: { type: String, required: true },
  },
  twoFASecret: String,
  is2FAEnabled: { type: Boolean, default: false },
});

const MANAGER = mongoose.model("manager", managerSchema);
export default MANAGER;
