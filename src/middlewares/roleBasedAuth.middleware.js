function containsAny(arr1, arr2) {
  return arr1.some((item) => arr2.includes(item));
}

const roleBasedAuthMiddleware = (roles) => async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "UnAuthorized" });
  }

  if (containsAny(roles, user.role)) {
    return next();
  } else {
    return res.status(401).json({ message: "User not authorized" });
  }
};

export default roleBasedAuthMiddleware;
