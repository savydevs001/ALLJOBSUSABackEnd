import { z } from "zod";
import mongoose from "mongoose";
import PRODUCT_RELEASE from "../database/models/relases-notes.js";

const createReleaseZodSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  product: z.array(z.string()).optional(),
  bannerUrl: z.string().optional()
});

const createRelase = async (req, res) => {
  const parsed = createReleaseZodSchema.parse(req.body);
  try {
    const release = new PRODUCT_RELEASE({
      ...parsed,
    });
    await release.save();
    return res.status(201).json({
      message: "Product Release added succesfully",
      _id: release._id.toString(),
    });
  } catch (err) {
    console.log("Error creating new Release: ", err);
    return res
      .status(500)
      .json({ message: "Error creating new Release", err: err.message });
  }
};

// get all
const getAllReleases = async (req, res) => {
  try {
    const releases = await PRODUCT_RELEASE.find({}).sort({ createdAt: -1 });
    const tranformed = releases.map((e) => ({
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      category: e.category,
      product: e.product,
      createdAt: e.createdAt,
      bannerUrl: e.bannerUrl || null
    }));
    return res.status(200).json({ releases: tranformed });
  } catch (err) {
    console.log("Error getting releases: ", err);
    return res
      .status(500)
      .json({ message: "Error getting release", err: err.message });
  }
};

// get by id
const getReleaseById = async (req, res) => {
  try {
    const id = req.params.id;
    if(!id || !mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({message: "Invalid id"})
    }
    const e = await PRODUCT_RELEASE.findById(id)
    const tranformed = {
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      category: e.category,
      product: e.product,
      createdAt: e.createdAt,
      bannerUrl: e.bannerUrl || null
    }
    return res.status(200).json({ release: tranformed });
  } catch (err) {
    console.log("Error getting release: ", err);
    return res
      .status(500)
      .json({ message: "Error getting release", err: err.message });
  }
};

// edit job
const editRelease = async (req, res) => {
  const parsed = createReleaseZodSchema.parse(req.body);
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Not found " });
  }
  try {
    const release = await PRODUCT_RELEASE.findById(id);
    if (!release) {
      return res.status(404).json({ message: "Release Not found" });
    }

    release.title = parsed.title;
    release.description = parsed.description;
    release.category = parsed.category;
    release.product = parsed.product;
    release.bannerUrl = parsed.bannerUrl
    await release.save();

    return res.status(200).json({
      message: "Release edited succesfully",
      _id: release._id.toString(),
    });
  } catch (err) {
    console.log("Error editing release: ", err);
    return res
      .status(500)
      .json({ message: "Error editing release", err: err.message });
  }
};

// delete job
const deleteRelease = async (req, res) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid id" });
  }
  try {
    const release = await PRODUCT_RELEASE.findByIdAndDelete(id);
    if (!release) {
      return res.status(404).json({ message: "Release Not found" });
    }

    return res.status(200).json({
      message: "Release deleted succesfully",
      _id: release._id.toString(),
    });
  } catch (err) {
    console.log("Error deleting Release: ", err);
    return res
      .status(500)
      .json({ message: "Error deleting Release", err: err.message });
  }
};

export { createRelase, getAllReleases, editRelease, deleteRelease, getReleaseById };
