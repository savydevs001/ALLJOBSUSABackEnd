import { z } from "zod";
import mongoose from "mongoose";
import EVENT from "../database/models/events.model.js";

const createEventZodSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string(),
  eventFor: z.string(z.enum(["job-seeker", "employer", "freelancer"])),
  dated: z.coerce.date(),
  bannerUrl: z.string().nullable().optional(),
});

const createEvent = async (req, res) => {
  const parsed = createEventZodSchema.parse(req.body);
  try {
    const event = new EVENT({
      ...parsed,
    });
    await event.save();
    return res.status(201).json({
      message: "Event added succesfully",
      _id: event._id.toString(),
    });
  } catch (err) {
    console.log("Error creating new Event: ", err);
    return res
      .status(500)
      .json({ message: "Error creating new Event", err: err.message });
  }
};

// get all
const getAllEvents = async (req, res) => {
  try {
    const eventFor = req.query.for;
    const filter = {};
    if (eventFor && ["job-seeker", "employer", "freelancer"].includes(eventFor)) {
      filter.eventFor = eventFor
    }

    const events = await EVENT.find(filter).sort({ createdAt: -1 });
    const tranformed = events.map((e) => ({
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      location: e.location,
      dated: e.dated,
      createdAt: e.createdAt,
      bannerUrl: e.bannerUrl || null,
      eventFor: e.eventFor,
    }));
    return res.status(200).json({ events: tranformed });
  } catch (err) {
    console.log("Error getting event: ", err);
    return res
      .status(500)
      .json({ message: "Error getting event", err: err.message });
  }
};

// get by id
const getEventById = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const e = await EVENT.findById(id);
    const tranformed = {
      _id: e._id.toString(),
      title: e.title,
      description: e.description,
      location: e.location,
      dated: e.dated,
      createdAt: e.createdAt,
      bannerUrl: e.bannerUrl || null,
      eventFor: e.eventFor,
    };
    return res.status(200).json({ event: tranformed });
  } catch (err) {
    console.log("Error getting event: ", err);
    return res
      .status(500)
      .json({ message: "Error getting event", err: err.message });
  }
};

// edit event
const editEvent = async (req, res) => {
  const parsed = createEventZodSchema.parse(req.body);
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid Id " });
  }
  try {
    const event = await EVENT.findById(id);
    if (!event) {
      return res.status(404).json({ message: "event Not found" });
    }

    event.title = parsed.title;
    event.description = parsed.description;
    event.eventFor = parsed.eventFor;
    event.location = parsed.location;
    event.dated = parsed.dated;
    event.bannerUrl = parsed.bannerUrl;
    await event.save();

    return res.status(200).json({
      message: "event edited succesfully",
      _id: event._id.toString(),
    });
  } catch (err) {
    console.log("Error editing event: ", err);
    return res
      .status(500)
      .json({ message: "Error editing event", err: err.message });
  }
};

// delete job
const deleteEvent = async (req, res) => {
  const id = req.params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Invalid id" });
  }
  try {
    const event = await EVENT.findByIdAndDelete(id);
    if (!event) {
      return res.status(404).json({ message: "Release Not found" });
    }

    return res.status(200).json({
      message: "event deleted succesfully",
      _id: event._id.toString(),
    });
  } catch (err) {
    console.log("Error deleting event: ", err);
    return res
      .status(500)
      .json({ message: "Error deleting event", err: err.message });
  }
};

export { createEvent, getAllEvents, getEventById, editEvent, deleteEvent };
