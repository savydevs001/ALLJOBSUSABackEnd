import FREELANCER from "../database/models/freelancer.model.js";
import PENDING_PAYOUT from "../database/models/pendingPayout.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import { createStripeTransfer } from "../services/stripe.service.js";

const runScheduledPayouts = async () => {
  try {
    const now = new Date();

    const pendingPayouts = await PENDING_PAYOUT.find({
      releaseDate: { $lte: now },
      transferred: false,
    });

    console.log("Total pending Payouts = ", pendingPayouts.length);

    for (const payout of pendingPayouts) {
      try {
        const trasnfer = await createStripeTransfer(
          payout.amount,
          payout.stripeAccountId,
          payout.transferGroup
        );

        await PENDING_PAYOUT.updateOne(
          { _id: payout._id },
          { transferred: true, transferId: trasnfer.id }
        );

        await TRANSACTION.updateOne(
          {
            _id: payout.transactionId,
            status: "escrow_held",
          },
          {
            status: "released_to_freelancer",
          }
        );

        await FREELANCER.findByIdAndUpdate(payout.freelancerId, {
          $inc: {
            totalEarning: payout.amount,
            currentBalance: payout.amount,
            pendingClearence: -payout.amount,
          },
        });

        console.log(
          `✅ Transferred $${payout.amount} to freelancer ${payout.freelancerId}`
        );
      } catch (err) {
        console.log(
          "❌ Error creating tranfor for pending payout: ",
          payout._id
        );
        console.log(err);
      }
    }
  } catch (err) {
    console.log("❌ Error running Scheudled Payouts: ", err);
  }
};

export { runScheduledPayouts };
