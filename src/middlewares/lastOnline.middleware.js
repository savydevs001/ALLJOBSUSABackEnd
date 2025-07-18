import User from "../database/models/users.model.js";

const lastOnlineMiddleware = async (req, res, next) => {
  try {
    if (!req.user) return res.redirect("/logout")
    if (!req.user?.role) return next();
    if (!req.user.role.includes("freelancer")) return next();

    await User.updateOne(
      { _id: req.user._id },
      { $set: { "freelancerDetails.lastOnline": new Date() } }
    );

    return next();
  } catch (err) {
    console.log("Error updating last online: ", err.message);
    return next();
  }
};

export default lastOnlineMiddleware;
