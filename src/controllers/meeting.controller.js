import dotenv from "dotenv";
import mongoose from "mongoose";
import { z } from "zod";
import MEETING from "../database/models/meetings.model.js";
import { sendOfferCreationMessage } from "../socket/init-socket.js";
import jwt from "jsonwebtoken";
dotenv.config();

const meetingZODSchema = z.object({
  name: z.string().optional(),
  startDate: z.coerce
    .date({
      errorMap: () => ({ message: "Invalid date format" }),
    })
    .optional(),
  withUserId: z.string(),
  withUserRole: z.enum(["freelancer", "job-seeker", "employer"], {
    errorMap: (e) => ({
      message: "Invalid User Role",
      err: e.message,
    }),
  }),
  startNow: z.coerce.boolean().default(true),
});

const MEETING_VALIDATION_TIME = 60 * 60 * 1000; // 60 minutes
const createMeeting = async (req, res) => {
  const parsed = meetingZODSchema.parse(req.body);
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }
    if (!mongoose.Types.ObjectId.isValid(parsed.withUserId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    if (parsed.startNow === false && new Date(parsed.startDate) < new Date()) {
      return res.status(400).json({ message: "Please select a future date" });
    }

    const start =
      parsed.startNow === true ? new Date() : new Date(parsed.startDate);
    const sessionName = parsed.name || `New Meeting`;
    const meeting = new MEETING({
      sessionName: sessionName,
      hostId: userId,
      hostModel: userRole == "job-seeker" ? "jobSeeker" : userRole,
      withUserId: parsed.withUserId,
      withUserModel:
        parsed.withUserRole == "job-seeker" ? "jobSeeker" : parsed.withUserRole,
      startTime: start,
      expiryTime: new Date(start.getTime() + MEETING_VALIDATION_TIME),
    });

    await meeting.save();

    sendOfferCreationMessage({
      from: userId.toString(),
      message: `New Meeting: ${meeting.sessionName}`,
      to: parsed.withUserId.toString(),
      offerId: null,
      meetingId: meeting._id.toString(),
    });

    return res
      .status(200)
      .json({ message: "Meeting created", _id: meeting._id.toString() });
  } catch (err) {
    console.log("Error generating a meeting: ", err);
    return res
      .status(500)
      .json({ message: "Error generating a meeting", err: err.message });
  }
};

const generateMeetingJwtById = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res
        .status(200)
        .json({ message: "Invalid Meeting Id", isValid: false });
    }

    const userId = req.user._id;
    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res
        .status(200)
        .json({ message: "Meeting not found", isValid: false });
    }

    if (meeting.status != "new") {
      return res
        .status(200)
        .json({ message: "Meeting Already Processed", isValid: false });
    }

    if (
      ![meeting.hostId.toString(), meeting.withUserId.toString()].includes(
        userId
      )
    ) {
      return res
        .status(400)
        .json({ message: "You cannot join this meeting", isValid: false });
    }

    if (meeting.expiryTime < new Date()) {
      if (meeting.status == "new") {
        meeting.status = "expired";
        await meeting.save();
      }
      return res
        .status(200)
        .json({ message: "Meeting Expired", isValid: false, expired: true });
    }

    const combinedName =
      meeting.sessionName +
      "-" +
      meeting.startTime.toISOString() +
      "-" +
      meeting.createdAt.toISOString() +
      "-" +
      meeting.hostId.toString() +
      "-" +
      meeting.withUserId.toString();

    // if meeting time is not started
    const threshold = 2 * 60 * 1000;
    if (
      new Date(meeting.startTime).getTime() - threshold >
      new Date().getTime()
    ) {
      return res.json({
        signature: null,
        isValid: true,
        expired: false,
        inFuture: true,
        name: combinedName,
        startAt: meeting.startTime,
        message: "Request again when meeting time arrives",
      });
    }

    // set start time
    if (!meeting.startTime) {
      meeting.startTime = new Date();
      await meeting.save();
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 2; // payload is valid for 2 hours
    const meetingRole = meeting.hostId.toString() == userId.toString() ? 1 : 0;
    const oPayload = {
      app_key: process.env.ZOOM_VIDEO_SDK_KEY,
      role_type: meetingRole,
      tpc: combinedName,
      version: 1,
      iat,
      exp,
      user_identity: userId,
      video_webrtc_mode: true,
      audio_webrtc_mode: true,
      session_idle_timeout_mins: 5,
      session_max_minutes: 40,
    };
    // const sPayload = JSON.stringify(oPayload);
    const sdkJWT = jwt.sign(oPayload, process.env.ZOOM_VIDEO_SDK_SECRET, {
      algorithm: "HS256",
    });
    return res.json({
      signature: sdkJWT,
      isValid: true,
      expired: false,
      name: combinedName,
      startAt: meeting.startTime,
      isHost: meetingRole === 1 ? true : false,
    });
  } catch (err) {
    console.log("Error getting a meeting: ", err);
    return res
      .status(500)
      .json({ message: "Error getting a meeting", err: err.message });
  }
};

const completeMeeting = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid Meeting Id" });
    }

    const userId = req.user._id;
    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Invalid Meeting Id" });
    }

    if (
      ![meeting.hostId.toString(), meeting.withUserId.toString()].includes(
        userId
      )
    ) {
      return res
        .status(400)
        .json({ message: "You cannot complete this meeting" });
    }

    if (meeting.status != "new") {
      return res.status(400).json({
        message: "This meeting has already processed",
        err: "Only New meetings can be completed",
      });
    }

    meeting.status = "completed";
    meeting.endingTime = new Date();
    await meeting.save();

    return res
      .status(200)
      .json({ message: "Updated", meetingId: meeting._id.toString() });
  } catch (err) {
    console.log("Error setting status of meeting to completed: ", err);
    return res.status(500).json({
      message: "Error setting status of meeting to completed",
      err: err.message,
    });
  }
};

const emptyMeeting = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid Meeting Id" });
    }

    const userId = req.user._id;
    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Invalid Meeting Id" });
    }

    if (
      ![meeting.hostId.toString(), meeting.withUserId.toString()].includes(
        userId
      )
    ) {
      return res
        .status(400)
        .json({ message: "You cannot complete this meeting" });
    }

    if (meeting.status != "new") {
      return res.status(400).json({
        message: "This meeting has already processed",
        err: "Only New meetings can be completed",
      });
    }

    meeting.status = "empty";
    meeting.endingTime = new Date();
    await meeting.save();

    return res
      .status(200)
      .json({ message: "Updated", meetingId: meeting._id.toString() });
  } catch (err) {
    console.log("Error setting status of meeting to empty: ", err);
    return res.status(500).json({
      message: "Error setting status of meeting to empty",
      err: err.message,
    });
  }
};

// cancel
const cancelMeeting = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid Meeting Id" });
    }

    const userId = req.user._id;
    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Invalid Meeting Id" });
    }

    if (meeting.hostId.toString() !== userId) {
      return res
        .status(400)
        .json({ message: "You cannot cancel this meeting" });
    }

    if (meeting.status != "new") {
      return res.status(400).json({
        message: "This meeting has already processed",
        err: "Only New meetings can be cncelled",
      });
    }

    meeting.status = "cancelled";
    await meeting.save();

    return res
      .status(200)
      .json({ message: "Updated", meetingId: meeting._id.toString() });
  } catch (err) {
    console.log("Error setting status of meeting to cancelled: ", err);
    return res.status(500).json({
      message: "Error setting status of meeting to cancelled",
      err: err.message,
    });
  }
};

// reject
const rejectMeeting = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid Meeting Id" });
    }

    const userId = req.user._id;
    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Invalid Meeting Id" });
    }

    if (meeting.withUserId.toString() !== userId) {
      return res
        .status(400)
        .json({ message: "You cannot reject this meeting" });
    }

    if (meeting.status != "new") {
      return res.status(400).json({
        message: "This meeting has already processed",
        err: "Only New meetings can be rejected",
      });
    }

    meeting.status = "rejected";
    await meeting.save();

    return res
      .status(200)
      .json({ message: "Updated", meetingId: meeting._id.toString() });
  } catch (err) {
    console.log("Error setting status of meeting to rejected: ", err);
    return res.status(500).json({
      message: "Error setting status of meeting to rejected",
      err: err.message,
    });
  }
};

// get meeting public info by id
const meetingById = async (req, res) => {
  const meetingId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res.status(400).json({ message: "Invalid Meeting Id" });
    }

    const meeting = await MEETING.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Invalid Meeting Id" });
    }

    if (meeting.expiryTime < new Date() && meeting.status == "new") {
      meeting.status = "expired";
      await meeting.save();
    }

    let duration = null;
    if (meeting.endingTime && meeting.startTime) {
      const durationMs =
        new Date(meeting.endingTime).getTime() -
        new Date(meeting.startTime).getTime();
      duration = Math.floor(durationMs / 1000 / 60);
    }

    const transformedData = {
      _id: meeting._id.toString(),
      host: meeting.hostId.toString(),
      user: meeting.withUserId.toString(),
      status: meeting.status,
      duraton: duration,
      createdAt: meeting.createdAt,
      startAt: meeting.startTime,
      name: meeting.sessionName,
    };

    return res.status(200).json({ meeting: transformedData });
  } catch (err) {
    console.log("Error getting meeting by id: ", err);
    return res.status(500).json({
      message: "Error  getting meeting by id",
      err: err.message,
    });
  }
};

export {
  createMeeting,
  generateMeetingJwtById,
  completeMeeting,
  emptyMeeting,
  meetingById,
  cancelMeeting,
  rejectMeeting,
};
