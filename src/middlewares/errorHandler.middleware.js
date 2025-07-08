import { ZodError } from "zod";

const errorHandlerMiddleware = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Invalid or Incomplete data",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }
  res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default errorHandlerMiddleware;
