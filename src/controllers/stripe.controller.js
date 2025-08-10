import mongoose from "mongoose";
import {
  cancelStripeSubscription,
  createStripePaymentIntent,
  createStripePayout,
  createStripeTransferToPlatform,
  findOrCreateCustomer,
  getStripeAccountbyId,
  getStripeBalanceByAccountId,
  getTotalIncomeAndMonthlyChange,
  retriveStripePaymentIntent,
  retriveSubscription,
} from "../services/stripe.service.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import { getMemorySubscriptionns } from "./subscriptions.controller.js";
import TRANSACTION from "../database/models/transactions.model.js";
import Offer from "../database/models/offers.model.js";
import abortSessionWithMessage from "../utils/abortSession.js";
import Job from "../database/models/jobs.model.js";
import Order from "../database/models/order.model.js";
import PlatformSettings from "../database/models/palteform.model.js";

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

const cancelAutoRenewl = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    if (userRole != "employer") {
      return res.status(400).json({
        message: "Only employer can cancel a job posting subscription",
      });
    }

    const employer = await EMPLOYER.findById(userId);
    if (!employer) {
      return res.status(400).json({ message: "USer not found" });
    }

    if (employer.susbscriptionRenew === false) {
      return res
        .status(400)
        .json({ message: "Subscription renewal already stoppped" });
    }

    const stripeSubscription = await retriveSubscription(
      employer.stripeProfileSubscriptionId
    );
    if (
      stripeSubscription.status !== "active" &&
      stripeSubscription.status !== "trialing"
    ) {
      return res.status(400).json({
        error: `Subscription is not active or trialing (status: ${stripeSubscription.status})`,
      });
    }

    const cancelled = await cancelStripeSubscription(
      employer.stripeProfileSubscriptionId
    );

    employer.susbscriptionRenew = false;
    await employer.save();

    return res.status(200).json({
      message: "Auto-renewal cancelled. Subscription will end at period end.",
      subscription: {
        id: cancelled.id,
        status: cancelled.status,
        cancel_at_period_end: cancelled.cancel_at_period_end,
        current_period_end: cancelled.current_period_end,
      },
    });
  } catch (err) {
    console.log("❌ Error cancelling subscription: ", err);
    return res
      .status(500)
      .json({ message: "Error cancelling subscription:", err });
  }
};

/***
 *
 * Prupose: "subscription"  | "resume" | "cover" | "order_payment"
 */
const createPaymentIntents = async (req, res) => {
  try {
    const { purpose, itemId } = req.body;
    if (
      !purpose ||
      purpose == "" ||
      ![
        "subscription",
        "resume",
        "cover",
        "order_payment",
        "order_bonus",
      ].includes(purpose)
    ) {
      return res.status(400).json({ message: "Invalid Purpose" });
    }

    if (!itemId || itemId == "") {
      return res.status(400).json({ message: "Invalid Item" });
    }

    // user validation
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid User" });
    }
    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }
    if (!user || user.status == "suspended" || user.status == "deleted") {
      return res.status(400).json({ message: "Invalid User" });
    }

    switch (purpose) {
      case "subscription":
        if (userRole !== "employer") {
          return res.status(400).json({
            message: "Only Employers are allowed for this kind of payment",
          });
        }
        const subscriptions = await getMemorySubscriptionns();
        if (!subscriptions) {
          return res
            .status(500)
            .json({ message: "Failed to retrive subscriptions" });
        }
        const requestedSubscription = subscriptions.find(
          (e) => e._id.toString() === itemId.toString()
        );
        if (!requestedSubscription) {
          return res.status(404).json({ message: "No subscription found" });
        }
        if (requestedSubscription.isActive == false) {
          return res.status(400).json({ message: "Subscription paused" });
        }
        // Add Transaction to DB
        const transaction = new TRANSACTION({
          mode: "profile-subscription",
          subscriptionDetails: {
            subscriptionId: requestedSubscription._id,
            userId: user._id,
          },
        });
        // initailze params
        const stripeIntentParams = {
          amount: requestedSubscription.price * 100,
          metadata: {
            purpose: "profile-subscription",
            userId: user._id.toString(),
            subscriptionId: requestedSubscription._id.toString(),
            userRole: "employer",
            transactionId: transaction._id.toString(),
          },
        };
        // console.log("stripeIntentParams: ", stripeIntentParams);

        if (requestedSubscription.mode == "subscription") {
          const { renew } = req.body;

          // get or create a customer for recurring
          let customerId = user.stripeCustomerId;
          if (!customerId) {
            // create a new customer Id
            customerId = await findOrCreateCustomer(user.email);
            if (!customerId) {
              return res
                .status(500)
                .json({ message: "No Customer for stripe" });
            }
            user.stripeCustomerId = customerId;
          }
          user.susbscriptionRenew = Boolean(renew);
          await user.save();
          stripeIntentParams.customer = customerId;
          stripeIntentParams.setup_future_usage = "off_session"; // Critical for recurring
          stripeIntentParams.description = `Recurring payment for Subscription ${requestedSubscription._id}`;
        }

        const paymentIntent = await createStripePaymentIntent(
          stripeIntentParams
        );

        await transaction.save();
        return res.json({
          clientSecret: paymentIntent.client_secret,
          // paymentIntentId: paymentIntent.id,
          price: requestedSubscription.price,
        });

      // case "order_payment":
      //   if (!["employer", "job-seeker"].includes(userRole)) {
      //     return res.status(400).json({ message: "Invalid Employer role" });
      //   }

      //   const session = await mongoose.startSession();
      //   session.startTransaction();
      //   try {
      //     const offer = await Offer.findById(itemId).session(session);
      //     if (!offer || offer.status === "accepted") {
      //       return abortSessionWithMessage(
      //         res,
      //         session,
      //         "Offer not Valid",
      //         400
      //       );
      //     }
      //     if (offer.receiverId.toString() != userId.toString()) {
      //       return abortSessionWithMessage(
      //         res,
      //         session,
      //         "You are not allowed to accept this offerr",
      //         403
      //       );
      //     }
      //     // validate the freelancer
      //     const freelancer = await FREELANCER.findById(offer.senderId);
      //     if (!freelancer || freelancer.status != "active") {
      //       return abortSessionWithMessage(
      //         res,
      //         session,
      //         "Invalid Freelancer",
      //         400
      //       );
      //     }
      //     // check job
      //     let job = null;
      //     if (offer.jobId) {
      //       job = await Job.findById(offer.jobId);
      //       if (!job || job.status != "empty") {
      //         return abortSessionWithMessage(
      //           res,
      //           session,
      //           "This job is not empty",
      //           400
      //         );
      //       }
      //       if (job.job != "freelance") {
      //         return abortSessionWithMessage(
      //           res,
      //           session,
      //           "This is not a freelance job",
      //           400
      //         );
      //       }
      //     }

      //     // Prevent duplicate order for same offer
      //     const existingOrder = await Order.findOne({
      //       offerId: offer._id,
      //     }).session(session);
      //     if (existingOrder) {
      //       if (existingOrder.status == "payment_pending") {
      //         const existingTrnsaction = await TRANSACTION.findById(
      //           existingOrder.transactionId
      //         );
      //         if (
      //           existingTrnsaction &&
      //           existingTrnsaction.orderDeatils?.stripeIntentId
      //         ) {
      //           await session.abortTransaction();
      //           session.endSession();
      //           const savedIntent = await retriveStripePaymentIntent(
      //             existingTrnsaction.orderDeatils?.stripeIntentId
      //           );
      //           return res.json({
      //             clientSecret: savedIntent.client_secret,
      //             price: savedIntent.amount / 100,
      //           });
      //         }
      //       } else {
      //         return abortSessionWithMessage(
      //           res,
      //           session,
      //           "Order already processed",
      //           409
      //         );
      //       }
      //     }

      //     const totalAmount = offer.price;
      //     let companyCut = 0;
      //     const plateform = (await PlatformSettings.find({}))[0];
      //     if (plateform.pricing.platformCommissionPercentageActive === true) {
      //       companyCut = Math.round(
      //         totalAmount *
      //           (plateform.pricing.platformCommissionPercentage / 100)
      //       );
      //     }
      //     // create transaction
      //     const transaction = new TRANSACTION({
      //       mode: "order",
      //       orderDeatils: {
      //         freelancerId: offer.senderId,
      //         totalAmount: totalAmount,
      //         amountToBePaid: totalAmount - companyCut,
      //       },
      //     });
      //     const now = new Date();
      //     // create order
      //     const order = new Order({
      //       offerId: offer._id,
      //       jobId: job ? job._id : null,
      //       employerId: userId,
      //       employerModel:
      //         userRole == "job-seeker"
      //           ? "jobSeeker"
      //           : userRole == "employer"
      //           ? "employer"
      //           : "",
      //       freelancerId: offer.senderId,
      //       title: `${job ? job.title : offer.title ? offer.title : "Project"}`,
      //       description: job
      //         ? job.description
      //         : offer.description
      //         ? offer.description
      //         : "description",
      //       totalAmount: offer.price,
      //       status: "payment_pending",
      //       deadline: now.setDate(now.getDate() + offer.duration),
      //       milestones: offer.milestones || [],
      //       transactionId: transaction.id,
      //     });
      //     transaction.orderDeatils.orderId = order.id;

      //     // initailze params
      //     const stripeIntentParams = {
      //       amount: offer.price * 100,
      //       metadata: {
      //         purpose: "order-payment",
      //         orderId: order._id.toString(),
      //         jobId: job && job._id.toString(),
      //         offerId: offer._id.toString(),
      //         employerId: userId.toString(),
      //         transactionId: transaction._id.toString(),
      //         freelancerId: freelancer._id.toString(),
      //       },
      //     };
      //     const paymentIntent = await createStripePaymentIntent(
      //       stripeIntentParams
      //     );
      //     transaction.orderDeatils.stripeIntentId = paymentIntent.id;

      //     await order.save({ session });
      //     await transaction.save({ session });
      //     await session.commitTransaction();
      //     session.endSession();

      //     return res.json({
      //       clientSecret: paymentIntent.client_secret,
      //       price: offer.price,
      //     });
      //   } catch (err) {
      //     console.log("❌Error processing order: ", err);
      //     return abortSessionWithMessage(
      //       res,
      //       session,
      //       "Error creating order",
      //       400
      //     );
      //   }

      case "order_payment": {
        if (!["employer", "job-seeker"].includes(userRole)) {
          return res.status(400).json({ message: "Invalid user role." });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const offer = await Offer.findById(itemId).session(session);
          if (!offer) {
            return abortSessionWithMessage(
              res,
              session,
              "Offer not valid",
              400
            );
          }
          if (offer.status === "accepted") {
            return abortSessionWithMessage(
              res,
              session,
              "Offer Already Accepted",
              400
            );
          }

          if (offer.receiverId.toString() !== userId.toString()) {
            return abortSessionWithMessage(
              res,
              session,
              "Unauthorized offer access",
              403
            );
          }

          const freelancer = await FREELANCER.findById(offer.senderId);
          if (!freelancer || freelancer.status !== "active") {
            return abortSessionWithMessage(
              res,
              session,
              "Invalid freelancer",
              400
            );
          }

          let job = null;
          if (offer.jobId) {
            job = await Job.findById(offer.jobId);
            if (!job || job.status !== "empty") {
              return abortSessionWithMessage(
                res,
                session,
                "Job not available",
                400
              );
            }
            if (job.job !== "freelance") {
              return abortSessionWithMessage(
                res,
                session,
                "Not a freelance job",
                400
              );
            }
          }

          const existingOrder = await Order.findOne({
            offerId: offer._id,
          }).session(session);

          if (existingOrder) {
            if (existingOrder.status === "payment_pending") {
              const existingTransaction = await TRANSACTION.findById(
                existingOrder.transactionId
              );
              if (existingTransaction?.orderDeatils?.stripeIntentId) {
                await session.abortTransaction();
                session.endSession();

                const savedIntent = await retriveStripePaymentIntent(
                  existingTransaction.orderDeatils.stripeIntentId
                );

                return res.json({
                  clientSecret: savedIntent.client_secret,
                  price: savedIntent.amount / 100,
                });
              }
            } else {
              return abortSessionWithMessage(
                res,
                session,
                "Order already processed",
                409
              );
            }
          }

          const totalAmount = offer.price;
          let companyCut = 0;
          const platformSettings = await PlatformSettings.findOne();

          if (platformSettings?.pricing?.platformCommissionPercentageActive) {
            companyCut = Math.round(
              totalAmount *
                (platformSettings.pricing.platformCommissionPercentage / 100)
            );
          }

          const transaction = new TRANSACTION({
            mode: "order",
            orderDeatils: {
              freelancerId: offer.senderId,
              totalAmount,
              amountToBePaid: totalAmount - companyCut,
            },
          });

          const now = new Date();

          const order = new Order({
            offerId: offer._id,
            jobId: job ? job._id : null,
            employerId: userId,
            employerModel: userRole === "job-seeker" ? "jobSeeker" : "employer",
            freelancerId: offer.senderId,
            title: job?.title || offer.title || "Project",
            description: job?.description || offer.description || "description",
            totalAmount,
            status: "payment_pending",
            deadline: now.setDate(now.getDate() + offer.duration),
            milestones: offer.milestones || [],
            transactionId: transaction._id,
          });

          transaction.orderDeatils.orderId = order._id;

          const stripeIntentParams = {
            amount: totalAmount * 100,
            metadata: {
              purpose: "order-payment",
              orderId: order._id.toString(),
              jobId: job?._id?.toString(),
              offerId: offer._id.toString(),
              employerId: userId.toString(),
              transactionId: transaction._id.toString(),
              freelancerId: freelancer._id.toString(),
            },
          };

          const paymentIntent = await createStripePaymentIntent(
            stripeIntentParams
          );
          transaction.orderDeatils.stripeIntentId = paymentIntent.id;

          // for Atomic Behariour of order
          try {
            await order.save({ session });
          } catch (e) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ message: "Order already exists." });
          }
          await transaction.save({ session });

          await session.commitTransaction();
          session.endSession();

          return res.json({
            clientSecret: paymentIntent.client_secret,
            price: totalAmount,
          });
        } catch (err) {
          console.error("❌ Error processing order:", err);
          await session.abortTransaction();
          session.endSession();
          return res.status(500).json({ message: "Error creating order" });
        }
      }

      case "order_bonus":
        try {
          const { amount } = req.body;
          if (!amount || Number.isNaN(Number(amount)) || Number(amount) < 5) {
            return res
              .status(400)
              .json({ message: "Invalid amount, It should be at least $5" });
          }

          // validate order
          if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ message: "Invalid Order" });
          }
          const order = await Order.findById(itemId);
          if (!order) {
            return res.status(404).json({ message: "Order not found!" });
          }

          const stripeIntentParams = {
            amount: Number(amount) * 100,
            metadata: {
              purpose: "order-bonus",
              orderId: order._id.toString(),
              freelancerId: order.freelancerId._id.toString(),
              amount: Number(amount),
            },
          };

          const paymentIntent = await createStripePaymentIntent(
            stripeIntentParams
          );
          return res.json({
            clientSecret: paymentIntent.client_secret,
            price: Number(amount),
          });
        } catch (err) {
          console.error("❌ Error processing bonus for order:", err);
          return res
            .status(500)
            .json({ message: "Error processing bonus for order" });
        }

      case "resume":
        try {
          if (req.user.role !== "freelancer") {
            return res.status(400).json({
              message: "Only freelancers are allowed to pay for resumes",
            });
          }

          const user = await FREELANCER.findById(userId).select(
            "status stripeAccountId currentBalance"
          );
          if (!user || user.status !== "active") {
            return res.status(400).json({ message: "Invalid User", paid });
          }
          // plans
          const allPlans = await getMemorySubscriptionns();
          const plan = allPlans.find((e) => e.mode === "resume");
          if (!plan) {
            return res.status(400).json({ message: "No Plan Avaiable" });
          }
          if (!plan.isActive) {
            return res
              .status(400)
              .json({ message: "Resume downloads are paused" });
          }

          if (user.stripeAccountId) {
            const balance = await getStripeBalanceByAccountId(
              user.stripeAccountId
            );
            const availableBalance =
              balance.available.find((b) => b.currency === "usd")?.amount || 0;

            if (availableBalance >= plan.price * 100) {
              // create transfer
              const transfer = await createStripeTransferToPlatform(
                plan.price,
                user.stripeAccountId
              );

              if (transfer) {
                user.currentBalance = Number(user.currentBalance - plan.price);
                user.canDownloadResume = true;
                await user.save();
                return res.status(200).json({
                  message: "Tranfer done from user account",
                  paid: true,
                  clientSecret: "",
                  price: plan.price,
                });
              }
            }
          }

          // create intent
          const stripeIntentParams = {
            amount: plan.price * 100,
            description: "Resume for user: " + user._id,
            metadata: {
              purpose: "resume-payment",
              freelancerId: user._id.toString(),
            },
          };

          const paymentIntent = await createStripePaymentIntent(
            stripeIntentParams
          );
          return res.json({
            clientSecret: paymentIntent.client_secret,
            price: plan.price,
          });
        } catch (err) {
          console.log("❌ Error processing payment: " + err);
          return res
            .status(500)
            .json({ message: "Error processing payment: " + err });
        }

      case "cover":
        try {
          if (req.user.role !== "freelancer") {
            return res.status(400).json({
              message: "Only freelancers are allowed to pay for cover letters",
            });
          }

          const user = await FREELANCER.findById(userId).select(
            "status stripeAccountId currentBalance"
          );
          if (!user || user.status !== "active") {
            return res.status(400).json({ message: "Invalid User", paid });
          }
          // plans
          const allPlans = await getMemorySubscriptionns();
          const plan = allPlans.find((e) => e.mode === "cover");
          if (!plan) {
            return res.status(400).json({ message: "No Plan Avaiable" });
          }
          if (!plan.isActive) {
            return res
              .status(400)
              .json({ message: "Cover Letter downloads are paused" });
          }

          if (user.stripeAccountId) {
            const balance = await getStripeBalanceByAccountId(
              user.stripeAccountId
            );
            const availableBalance =
              balance.available.find((b) => b.currency === "usd")?.amount || 0;

            if (availableBalance >= plan.price * 100) {
              // create transfer
              const transfer = await createStripeTransferToPlatform(
                plan.price,
                user.stripeAccountId
              );

              if (transfer) {
                user.currentBalance = Number(user.currentBalance - plan.price);
                user.canDownloadCover = true;
                await user.save();
                return res.status(200).json({
                  message: "Tranfer done from user account",
                  paid: true,
                  clientSecret: "",
                  price: plan.price,
                });
              }
            }
          }

          // create intent
          const stripeIntentParams = {
            amount: plan.price * 100,
            description: "Cover Letter for user: " + user._id,
            metadata: {
              purpose: "cover-payment",
              freelancerId: user._id.toString(),
            },
          };

          const paymentIntent = await createStripePaymentIntent(
            stripeIntentParams
          );
          return res.json({
            clientSecret: paymentIntent.client_secret,
            price: plan.price,
          });
        } catch (err) {
          console.log("❌ Error processing payment: " + err);
          return res
            .status(500)
            .json({ message: "Error processing payment: " + err });
        }

      default:
        return res.status(400).json({ message: "Invalid purpose" });
    }
  } catch (err) {
    console.log("X Error creating payment intent: ", err);
    return res.status(500).json({ message: "Error creating Intent" });
  }
};

// check freelancer account status for payout
const checkFreelancerPayoutSattus = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await FREELANCER.findById(userId);
    if (!user || !user.stripeAccountId) {
      return res.status(400).json({
        message: "Stripe account not connected.",
      });
    }

    // Fetch Stripe account info
    const account = await getStripeAccountbyId(user.stripeAccountId);

    // Check if payouts are enabled
    const enabled = account.payouts_enabled;

    // Available payout methods from external accounts
    const methods = [];
    if (account.external_accounts?.data?.length) {
      for (const acc of account.external_accounts.data) {
        if (acc.object === "bank_account") {
          methods.push({
            id: acc.id,
            type: "bank_account",
            details: `**** ${acc.last4} (${acc.bank_name})`,
          });
        } else if (acc.object === "card") {
          methods.push({
            id: acc.id,
            type: "card",
            details: `**** ${acc.last4} (${acc.brand})`,
          });
        }
      }
    }

    return res.json({ enabled, methods });
  } catch (err) {
    console.error("Error fetching payout status:", err);
    return res.status(500).json({
      message: "Failed to fetch payout info.",
    });
  }
};

// create freelancer payout
const createFreelancerPayout = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Invalid payout amount.",
      });
    }

    const user = await FREELANCER.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found!.",
      });
    }

    if (!user.stripeAccountId) {
      return res.status(400).json({
        message: "Stripe account not connected.",
      });
    }

    // check how much user can withdraw
    if (amount > user.currentBalance) {
      return res.status(400).json({
        message: "Not enough balance",
      });
    }

    // Ensure payouts are enabled
    const account = await getStripeAccountbyId(user.stripeAccountId);
    if (!account.payouts_enabled) {
      return res.status(400).json({
        error: { message: "Payouts are not enabled for this account." },
      });
    }

    // Stripe amounts are in cents
    const payout = await createStripePayout(amount, user.stripeAccountId);

    // Optional: Store in DB
    user.payoutHistory.push({
      amount,
      stripePayoutId: payout.id,
      status: payout.status,
      createdAt: new Date(),
    });
    user.currentBalance = user.currentBalance - amount;
    await user.save();

    return res.json({ message: "Payout created successfully", payout });
  } catch (err) {
    console.error("Error creating payout:", err);
    return res.status(500).json({
      error: { message: err?.raw?.message || "Failed to create payout." },
    });
  }
};

export {
  calculateTotalSubscriptionEarning,
  createPaymentIntents,
  cancelAutoRenewl,
  checkFreelancerPayoutSattus,
  createFreelancerPayout,
};
