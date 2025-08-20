import mongoose from "mongoose";
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
        // const trasnfer = await createStripeTransfer(
        //   payout.amount,
        //   payout.stripeAccountId,
        //   payout.transferGroup
        // );

        // if (!trasnfer) {
        //   continue;
        // }

        // await PENDING_PAYOUT.updateOne(
        //   { _id: payout._id },
        //   { transferred: true, transferId: trasnfer.id }
        // );
        await PENDING_PAYOUT.updateOne(
          { _id: payout._id },
          { transferred: true }
        );

        if (payout.transactionId) {
          await TRANSACTION.findOneAndUpdate(
            {
              _id: payout.transactionId,
              "orderDeatils.status": "escrow_held",
            },
            {
              "orderDeatils.status": "released_to_freelancer",
            }
          );
        }

        if (payout.type == "order_tip") {
          await FREELANCER.updateOne(
            { _id: payout.freelancerId },
            {
              $inc: {
                totalEarning: payout.amount,
                currentBalance: payout.amount,
                tip: payout.amount || 0,
                pendingClearence: -payout.amount,
              },
            }
          );
        } else if (payout.type == "order_payment") {
          await FREELANCER.updateOne(
            { _id: payout.freelancerId },
            {
              $inc: {
                totalEarning: payout.amount,
                currentBalance: payout.amount,
                pendingClearence: -payout.amount,
              },
            }
          );
        }

        console.log(
          `✅ Transferred $${payout.amount} to freelancer ${payout.freelancerId}`
        );
      } catch (err) {
        console.log(
          "❌ Error creating tranfer for pending payout: ",
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
