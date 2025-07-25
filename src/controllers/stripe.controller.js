import { getTotalIncomeAndMonthlyChange } from "../services/stripe.service.js";

const calculateTotalSubscriptionEarning = async (req, res) => {
  try {
    const data = await getTotalIncomeAndMonthlyChange();
    if (!data) {
      return res.status(404).json({ message: "Unable to calculate" });
    }
    return res.status(200).json({ data });
  } catch (err) {
    console.log("Error calculating Subscription Earning: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

export { calculateTotalSubscriptionEarning };
