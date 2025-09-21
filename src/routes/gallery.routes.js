import { Router } from "express";
import GALLERY from "../database/models/gallery.model.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { z } from "zod";
import deleteFile from "../utils/deleteFile.js";

const GalleryRouter = Router();

// GET GALLERY
GalleryRouter.get(
  "/",
  a(async (req, res) => {
    try {
      const gallery = await GALLERY.findOne({});
      if (!gallery) {
        return res.status(200).json({ data: [] });
      }

      gallery.gallery.sort((a, b) => a.order - b.order);
      return res.status(200).json({ data: gallery.gallery });
    } catch (err) {
      console.log("Error getting image gallery: ", err);
      return res
        .status(500)
        .json({ message: "Error getting image gallery", err: err.message });
    }
  })
);

// VALIDATION SCHEMA
const UpdateGallerySchema = z.object({
  data: z.array(
    z.object({
      fileUrl: z.string().min(1),
      fileName: z.string().min(1),
      order: z.coerce.number(),
    })
  ),
});

// UPDATE GALLERY
GalleryRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(async (req, res) => {
    const parsed = UpdateGallerySchema.parse(req.body);

    try {
      let gallery = await GALLERY.findOne({});
      if (!gallery) {
        gallery = await GALLERY.create({
          gallery: [],
        });
      }

      // Find files to delete
      const toDelete = gallery.gallery
        .filter(
          (oldItem) =>
            !parsed.data.some((newItem) => newItem.fileUrl === oldItem.fileUrl)
        )
        .map((item) => item.fileUrl);

      // Update DB
      gallery.gallery = parsed.data;
      await gallery.save();

      // Delete unused files
      await Promise.all(toDelete.map((fileUrl) => deleteFile(fileUrl)));

      return res.status(200).json({ message: "Gallery updated successfully" });
    } catch (err) {
      console.log("Error updating image gallery: ", err);
      return res
        .status(500)
        .json({ message: "Error updating image gallery", err: err.message });
    }
  })
);

export default GalleryRouter;
