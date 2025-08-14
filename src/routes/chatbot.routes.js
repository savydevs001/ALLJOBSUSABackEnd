import { Router } from "express";
import fs from "fs";
import path from "path";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { z } from "zod";
import a from "../utils/a.js";

const ChatBotRouter = Router();

const chatBotDataPath = path.resolve(process.cwd(), "./src/chatbotdata.json");

ChatBotRouter.get(
  "/",
  a(async (req, res) => {
    const data = fs.readFileSync(chatBotDataPath);
    const jsonData = JSON.parse(data);
    return res.status(200).json({ data: jsonData });
  })
);

const UpdateZodSchema = z.object({
  data: z.array(z.object({ question: z.string(), answer: z.string() })),
});
ChatBotRouter.put(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(async (req, res) => {
    const parsed = UpdateZodSchema.parse(req.body);
    try {
      fs.writeFileSync(chatBotDataPath, JSON.stringify(parsed.data), "utf-8");
      return res
        .status(200)
        .json({ data: parsed.data, message: "Data updated" });
    } catch (err) {
      console.log("❌ Error updating chatbot data: ", err);
      return res
        .status(500)
        .json({ message: "Error updating chatbot data", err });
    }
  })
);

export default ChatBotRouter;
