import { getStripeSession } from "../../services/stripe.service.js";
import EMPLOYER from "./employers.model.js";
import TRANSACTION from "./transactions.model.js";

const verifyStripeSession = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId)
    return res
      .status(400)
      .json({ success: false, message: "Missing session ID" });

  try {
    const session = await getStripeSession(sessionId);
    console.log(session)
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid session id" });
    }

    const metadata = session.metadata;
    const purpose = metadata.purpose;

    if (purpose == "profile-subscription") {
      //  validate metadata
      const transactionId = metadata.transactionId;
      if (!transactionId) {
        return res.status(404).json({
          success: false,
          message: "Transaction Id not found in metadata",
        });
      }
      const userId = metadata.userId;
      if (!userId) {
        return res.status(404).json({
          success: false,
          message: "user Id not found in metadata",
        });
      }

      // validate user
      const user = await EMPLOYER.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found!" });
      }
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // validate transaction
      const transaction = await TRANSACTION.findOne({
        _id: transactionId,
        mode: "profile-subscription",
        "subscriptionDetails.sessionId": sessionId,
      });
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "transaction not found",
        });
      }

      if (transaction.subscriptionDetails.status === "completed") {
        return res.status(200).json({
          success: true,
          message: "transaction succeed",
        });
      }

      return res
        .status(400)
        .json({ message: "Payment not successful", success: false });
    }

    return res
      .status(400)
      .json({
        message: "Payment not successful, invalid purpose",
        success: false,
      });
  } catch (err) {
    console.error("❌ Stripe session verification failed:", err);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

export { verifyStripeSession };
