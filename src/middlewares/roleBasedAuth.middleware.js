
const roleBasedAuthMiddleware = (roles) => async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "UnAuthorized" });
  }

  if (roles.includes(user.role)) {
    return next();
  } else {
    return res.status(401).json({ message: "User not authorized" });
  }
};

export default roleBasedAuthMiddleware;
