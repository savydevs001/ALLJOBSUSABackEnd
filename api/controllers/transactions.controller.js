import mongoose from "mongoose";
import Order from "../database/models/order.model.js";
import {
  generateStripePaymentIntent,
  getIntentById,
} from "../services/stripe.service.js";

const generatePaymentIntent = async (req, res) => {
  const { orderId } = req.body;
  const employerId = req.user?._id;
  const employerEmail = req.user?.email;

  if (!employerEmail) {
    return res.status(403).json({ message: "Invalid user details" });
  }

  // Validate order ID
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  const order = await Order.findById(orderId).populate({
    path: "freelancerId",
    select: "stripeAccountId", // optional: select specific fields
  });

  if (!order) {
    return res.status(404).json({ message: "Order not found!" });
  }

  if (!order.employerId.equals(employerId)) {
    return res.status(403).json({ message: "Unauthorized" });
  }

  if (
    order.status !== "payment_pending" ||
    order.paymentStatus !== "payment_pending"
  ) {
    return res
      .status(403)
      .json({ message: "No pending payment for this order!" });
  }

  if (order.intentId) {
    try {
      const intent = await getIntentById(order.intentId);
      return res.status(200).json({ client_secret: intent.client_secret });
    } catch (err) {
      console.log("❌ Error retriving stripe intent: ", err);
      return res.status(500).json({ message: "Error retrivinng intent" });
    }
  }

  try {
    const intent = await generateStripePaymentIntent(
      order.totalAmount,
      order._id.toString(),
      order.freelancerId.stripeAccountId
    );

    order.intentId = intent.id;
    await order.save();
    return res.status(200).json({ client_secret: intent.client_secret });
  } catch (err) {
    console.log("❌ Error generating stripe intent: ", err);
    return res.status(500).json({ message: "Error genrating intent" });
  }
};

export { generatePaymentIntent };
