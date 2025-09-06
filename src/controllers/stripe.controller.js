import mongoose from "mongoose";
import {
  cancelStripeSubscription,
  createStripePaymentIntent,
  createStripeTransfer,
  findOrCreateCustomer,
  getStripeAccountbyId,
  getTotalIncomeAndMonthlyChange,
  retriveStripePaymentIntent,
  retriveSubscription,
  rseumeSusbscriptionById,
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
import puppeteer from "puppeteer";
import uploadPdfBufferToStorage from "../utils/uploadPdfBuffer.js";
import { notifyUser } from "./notification.controller.js";

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
      return res.status(400).json({ message: "User not found" });
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

const ResumeAutoRenewlSusbcription = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (userRole != "employer") {
      return res.status(400).json({
        message: "Only employer can continue a job posting subscription",
      });
    }

    const employer = await EMPLOYER.findById(userId);
    if (!employer) {
      return res.status(400).json({ message: "User not found" });
    }

    if (employer.susbscriptionRenew === true) {
      return res
        .status(400)
        .json({ message: "Subscription Already set for renewal" });
    }

    if (!employer.stripeProfileSubscriptionId) {
      return res
        .status(400)
        .json({ message: "No susbscription attached to user" });
    }

    const continued = await rseumeSusbscriptionById(
      employer.stripeProfileSubscriptionId
    );

    employer.susbscriptionRenew = true;
    await employer.save();

    return res.status(200).json({
      message: "Auto-renewal Continued",
      subscription: {
        id: continued.id,
        status: continued.status,
        cancel_at_period_end: continued.cancel_at_period_end,
        current_period_end: continued.current_period_end,
      },
    });
  } catch (err) {
    console.log("❌ Error continuing subscription: ", err);
    return res
      .status(500)
      .json({ message: "Error continuing subscription:", err });
  }
};

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
          receipt_email: user.email,
        };

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

          const totalAmount = offer.price;
          let companyCut = 0;
          let companyCommission = 0;
          const platformSettings = await PlatformSettings.findOne();

          if (
            platformSettings?.pricing?.platformCommissionPercentageActive ===
            true
          ) {
            companyCut = Math.round(
              totalAmount *
              (platformSettings.pricing.platformCommissionPercentage / 100)
            );
          }

          if (
            platformSettings?.pricing
              ?.platformCommissionPercentageForNonFreelancersActive === true
          ) {
            companyCommission = Math.round(
              totalAmount *
              (platformSettings.pricing
                .platformCommissionPercentageForNonFreelancers /
                100)
            );
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
                  orderPrice: totalAmount,
                  orderCommission: companyCommission,
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
            amount: (totalAmount + companyCommission) * 100,
            metadata: {
              purpose: "order-payment",
              orderId: order._id.toString(),
              jobId: job?._id?.toString(),
              offerId: offer._id.toString(),
              employerId: userId.toString(),
              transactionId: transaction._id.toString(),
              freelancerId: freelancer._id.toString(),
              totalAmount: totalAmount,
              companyCommission: companyCommission,
            },
            receipt_email: user.email,
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
            price: totalAmount + companyCommission,
            orderPrice: totalAmount,
            orderCommission: companyCommission,
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
            receipt_email: user.email,
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

          if (userRole == "freelancer" && user.currentBalance) {
            if (user.currentBalance >= plan.price) {
              user.currentBalance = Number(user.currentBalance - plan.price);
              user.canDownloadResume = true;
              await user.save();
              await PlatformSettings.findOneAndUpdate(
                {},
                { $inc: { "earnings.resume": plan.price } }
              )
              return res.status(200).json({
                message: "Transfer done from freelancer earnings",
                paid: true,
                clientSecret: "",
                price: plan.price,
              });
            }
          }

          const stripeIntentParams = {
            amount: plan.price * 100,
            description: "Resume for user: " + user._id,
            metadata: {
              purpose: "resume-payment",
              userId: user._id.toString(),
              userRole,
              amount: plan.price
            },
            receipt_email: user.email,
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

          if (userRole == "freelancer" && user.currentBalance) {
            if (user.currentBalance >= plan.price) {
              user.currentBalance = Number(user.currentBalance - plan.price);
              user.canDownloadCover = true;
              await user.save();
              await PlatformSettings.findOneAndUpdate(
                {},
                { $inc: { "earnings.cover": plan.price } }
              )
              return res.status(200).json({
                message: "Transfer done from freelancer earnings",
                paid: true,
                clientSecret: "",
                price: plan.price,
              });
            }
          }

          const stripeIntentParams = {
            amount: plan.price * 100,
            description: "Cover Letter for user: " + user._id,
            metadata: {
              purpose: "cover-payment",
              userId: user._id.toString(),
              userRole,
              amount: plan.price
            },
            receipt_email: user.email,
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
const fieldMessages = {
  // --- Business profile ---
  "business_profile.mcc": "Business category is missing",
  "business_profile.url": "Business website or profile link is missing",
  "business_profile.name": "Business name is missing",
  "business_profile.support_email": "Support email address is missing",
  "business_profile.support_phone": "Support phone number is missing",
  "business_profile.support_url": "Support website or help link is missing",
  "business_profile.product_description":
    "Business product/service description is missing",

  // --- External accounts (bank or debit card) ---
  external_account: "Bank account or debit card details are missing",

  // --- Terms acceptance ---
  "tos_acceptance.date": "Terms of Service acceptance is required",
  "tos_acceptance.ip": "IP address for Terms of Service acceptance is missing",

  // --- Individual (freelancer / sole proprietor) ---
  "individual.first_name": "First name is missing",
  "individual.last_name": "Last name is missing",
  "individual.email": "Email address is missing",
  "individual.phone": "Phone number is missing",
  "individual.dob.day": "Day of birth is missing",
  "individual.dob.month": "Month of birth is missing",
  "individual.dob.year": "Year of birth is missing",
  "individual.address.line1": "Address line 1 is missing",
  "individual.address.city": "City is missing",
  "individual.address.postal_code": "Postal code is missing",
  "individual.address.state": "State/Province is missing",
  "individual.id_number": "Government ID number is missing",
  "individual.ssn_last_4": "Last 4 digits of SSN are missing",
  "individual.verification.document":
    "Identity document (ID) needs to be uploaded",
  "individual.verification.additional_document":
    "Additional identity document is required",

  // --- Company / Business (if registered business account) ---
  "company.name": "Company name is missing",
  "company.tax_id": "Company tax ID is missing",
  "company.phone": "Company phone number is missing",
  "company.address.line1": "Company address line 1 is missing",
  "company.address.city": "Company city is missing",
  "company.address.postal_code": "Company postal code is missing",
  "company.address.state": "Company state/province is missing",
  "company.verification.document": "Company verification document is required",

  // --- Representative / Owners ---
  "representative.first_name": "Representative's first name is missing",
  "representative.last_name": "Representative's last name is missing",
  "representative.email": "Representative's email is missing",
  "representative.phone": "Representative's phone number is missing",
  "representative.dob.day": "Representative's day of birth is missing",
  "representative.dob.month": "Representative's month of birth is missing",
  "representative.dob.year": "Representative's year of birth is missing",
  "representative.address.line1": "Representative's address line 1 is missing",
  "representative.address.city": "Representative's city is missing",
  "representative.address.postal_code":
    "Representative's postal code is missing",
  "representative.address.state": "Representative's state/province is missing",
  "representative.verification.document":
    "Representative's identity document is missing",
  "representative.verification.additional_document":
    "Representative's additional identity document is required",

  // --- Directors / Owners (for larger businesses in some countries) ---
  directors: "Information about company directors is missing",
  owners: "Information about company owners is missing",
};

function translateRequirements(requirements) {
  return requirements.map(
    (req) => fieldMessages[req] || `Update required: ${req}`
  );
}

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
        enabled: false,
      });
    }

    // Fetch Stripe account info
    const account = await getStripeAccountbyId(user.stripeAccountId);

    // Stripe provides restriction reasons here
    const isRestricted =
      account.requirements?.currently_due?.length > 0 ||
      account.requirements?.eventually_due?.length > 0 ||
      !!account.requirements?.disabled_reason;

    // Payouts enabled flag
    const enabled = account.payouts_enabled && !isRestricted;

    if (!enabled) {
      return res.status(200).json({
        message:
          "Your Stripe account is restricted or payouts are paused. Please update your account information.",
        enabled: false,
        restrictions: {
          currently_due:
            translateRequirements(account.requirements?.currently_due || []) ||
            [],
          disabled_reason: account.requirements?.disabled_reason || null,
        },
      });
    }

    // Collect payout methods if account is fine
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

    return res.json({ enabled: true, methods });
  } catch (err) {
    console.error("Error fetching payout status:", err);
    return res.status(500).json({
      message: "Failed to fetch payout info.",
      enabled: false,
    });
  }
};

// create freelancer payout
const createFreelancerPayout = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
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

    const user = await FREELANCER.findById(userId).session(mongooseSession);
    if (!user) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "User not found",
        404
      );
    }

    if (!user.stripeAccountId) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Stripe account not connected.",
        400
      );
    }

    // check how much user can withdraw
    if (amount > user.currentBalance) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Not enough balance.",
        400
      );
    }

    // Ensure payouts are enabled
    const account = await getStripeAccountbyId(user.stripeAccountId);
    // Stripe provides restriction reasons here
    const isRestricted =
      account.requirements?.currently_due?.length > 0 ||
      account.requirements?.eventually_due?.length > 0 ||
      !!account.requirements?.disabled_reason;

    // Payouts enabled flag
    const enabled = account.payouts_enabled && !isRestricted;

    if (!enabled) {
      await mongooseSession.abortTransaction();
      await mongooseSession.endSession();
      return res.status(400).json({
        message:
          "Your Stripe account is restricted or payouts are paused. Please update your account information.",
        enabled: false,
        restrictions: {
          currently_due:
            translateRequirements(account.requirements?.currently_due || []) ||
            [],
          disabled_reason: account.requirements?.disabled_reason || null,
        },
      });
    }

    // Stripe amounts are in cents
    const transfer = await createStripeTransfer(
      amount,
      user.stripeAccountId,
      "Tranfer"
    );

    if (!transfer) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Unable to create tranfer",
        400
      );
    }

    user.payoutHistory.push({
      amount,
      stripeTransferId: transfer.id,
      status: transfer.status,
      createdAt: new Date(),
    });

    user.activity.unshift({
      title: `Withdrawn $${amount}`,
      subTitle: "Balance changes",
      at: new Date(),
    });
    if (user.activity.length > 3) {
      user.activity.splice(3);
    }

    user.currentBalance = user.currentBalance - amount;
    await user.save({ session: mongooseSession });

    await mongooseSession.commitTransaction();
    await mongooseSession.endSession();

    await notifyUser({
      userId: userId,
      userMail: user.email,
      ctaUrl: "freelancer/earnings",
      title: "Payment Transfer",
      message: `You payment of $${amount} will reach you account in 1-2 working days`,
      from: "ALLJOBSUSA",
    });

    return res.json({
      message: "Payout created successfully",
      transferId: transfer.id,
    });
  } catch (err) {
    console.error("Error creating payout:", err);
    return abortSessionWithMessage(
      res,
      mongooseSession,
      "Failed to create withdraw",
      500
    );
  }
};

// verify session
const verifyStripePaymentInetnt = async (req, res) => {
  const { clientSecret } = req.body;
  if (!clientSecret)
    return res
      .status(400)
      .json({ success: false, message: "Missing clientSecret" });

  try {
    const paymentIntentId = clientSecret.split("_secret_")[0];

    if (!paymentIntentId) {
      throw new Error("Invalid client secret format");
    }

    const intent = await retriveStripePaymentIntent(paymentIntentId);
    if (!intent) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid intent" });
    }

    switch (intent.status) {
      case "succeeded":
        return res
          .status(200)
          .json({ success: true, message: "Payment succeeded!" });
      case "processing":
        return res
          .status(200)
          .json({ success: false, message: "Your payment is processing." });
      case "requires_payment_method":
        return res.status(200).json({
          success: false,
          message: "Your payment was not successful, please try again.",
        });
      default:
        return res.status(200).json({
          success: false,
          message: `Unexpected status: ${paymentIntent.status}`,
        });
    }
  } catch (err) {
    console.error("❌ Stripe intent verification failed:", err);
    return res
      .status(500)
      .json({ message: "verification failed", success: false });
  }
};

// check if paid for resume
const checkPaidForResume = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }
    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      default:
        break;
    }
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    if (user.status != "active") {
      return res.status(400).json({
        message: "Only Active users are allowed to build resumes",
      });
    }

    const hasPaid = user.canDownloadResume === true;
    if (hasPaid) {
      return res.status(200).json({ hasPaid, amount: null });
    }

    const allPlans = await getMemorySubscriptionns();
    const plan = allPlans.find((e) => e.mode === "resume");
    if (!plan) {
      return res.status(400).json({ message: "No Plan Avaiable" });
    }
    if (!plan.isActive) {
      return res.status(400).json({ message: "Resume downloads are paused" });
    }

    let canPay = false;
    // if (userRole == "freelancer" && user.stripeAccountId) {
    //   const balance = await getStripeBalanceByAccountId(user.stripeAccountId);
    //   const availableBalance =
    //     balance.available.find((b) => b.currency === "usd")?.amount || 0;
    //   canPay = availableBalance >= plan.price * 100;
    // }
    if (userRole == "freelancer" && user.currentBalance) {
      canPay = user.currentBalance >= plan.price;
    }

    return res.status(200).json({ hasPaid, amount: plan.price, canPay });
  } catch (err) {
    console.log("❌ Erro checking if user has paid for resume: ", err);
    return res.status(500).json({ message: err });
  }
};

// pay for resume from freelancer balance
const downLoadResume = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { html } = req.body;

    if (!html || !userId) {
      return res.status(400).json({ message: "Missing data" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      default:
        break;
    }
    if (!user || user.status !== "active") {
      return res.status(400).json({ message: "Invalid User" });
    }

    if (user.canDownloadResume === true) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

      await page.setContent(
        `
        <!DOCTYPE html>
        <html>
          <head>${tailwindCDN}</head>
          <body style="margin:0; padding:0;">
            <div id="resume-wrapper" style="width:100%;">
              ${html}
            </div>
          </body>
        </html>
        `,
        { waitUntil: "networkidle0" }
      );

      // Measure actual rendered height in px
      const contentHeightPx = await page.evaluate(() => {
        const el = document.getElementById("resume-wrapper");
        return el ? el.scrollHeight : document.body.scrollHeight;
      });

      // Convert px → mm
      const contentHeightMM = contentHeightPx * 0.264583;

      // Generate PDF exactly to that size
      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: "210mm", // A4 width
        height: `${contentHeightMM}mm`, // Exact content height
        pageRanges: "1", // force only 1 page
      });

      await browser.close();

      // Save to DB
      if (!user.createdResumes) user.createdResumes = [];
      const { path } = await uploadPdfBufferToStorage(pdfBuffer);
      user.createdResumes.push({
        title: `${user.fullName}-${Date.now()}-resume.pdf`,
        url: path,
      });
      user.canDownloadResume = false;
      await user.save();

      // Send file
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      });

      return res.send(pdfBuffer);
    } else {
      return res
        .status(400)
        .json({ message: "Resume can be downloaded after payment" });
    }
  } catch (err) {
    console.log("❌ Error downloading: ", err);
    return res.status(500).json({ message: "Error downloading " + err });
  }
};

// check paid for cover letter
const checkPaidForCoverLetter = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      default:
        break;
    }
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    if (user.status != "active") {
      return res.status(400).json({
        message: "Only Active users are allowed to build resumes",
      });
    }

    const hasPaid = user.canDownloadCover === true;
    if (hasPaid) {
      return res.status(200).json({ hasPaid, amount: null });
    }

    const allPlans = await getMemorySubscriptionns();
    const plan = allPlans.find((e) => e.mode === "cover");
    if (!plan) {
      return res.status(400).json({ message: "No Plan Avaiable" });
    }
    if (!plan.isActive) {
      return res.status(400).json({ message: "Cover downloads are paused" });
    }

    let canPay = false;
    // if (userRole == "freelancer" && user.stripeAccountId) {
    //   const balance = await getStripeBalanceByAccountId(user.stripeAccountId);
    //   const availableBalance =
    //     balance.available.find((b) => b.currency === "usd")?.amount || 0;
    //   canPay = availableBalance >= plan.price * 100;
    // }

    if (userRole == "freelancer" && user.currentBalance) {
      canPay = user.currentBalance >= plan.price;
    }

    return res.status(200).json({ hasPaid, amount: plan.price, canPay });
  } catch (err) {
    console.log("❌ Erro checking if user has paid for cover: ", err);
    return res.status(500).json({ message: err });
  }
};

// downlaod cover
const downLoadCover = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { html } = req.body;

    if (!html || !userId) {
      return res.status(400).json({ message: "Missing data" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User" });
    }

    let user;
    switch (userRole) {
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      default:
        break;
    }
    if (!user || user.status !== "active") {
      return res.status(400).json({ message: "Invalid User" });
    }

    if (user.canDownloadCover === true) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

      await page.setContent(
        `
        <!DOCTYPE html>
        <html>
          <head>${tailwindCDN}</head>
          <body style="margin:0; padding:0;">
            <div id="cover-wrapper" style="width:100%;">
              ${html}
            </div>
          </body>
        </html>
        `,
        { waitUntil: "networkidle0" }
      );

      // Measure actual rendered height in px
      const contentHeightPx = await page.evaluate(() => {
        const el = document.getElementById("cover-wrapper");
        return el ? el.scrollHeight : document.body.scrollHeight;
      });

      // Convert px → mm
      const contentHeightMM = contentHeightPx * 0.264583;

      // Generate PDF exactly to that size
      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: "210mm", // A4 width
        height: `${contentHeightMM}mm`, // Exact content height
        pageRanges: "1", // ensure 1 page only
      });

      await browser.close();

      // Save to DB
      if (!user.createdCovers) user.createdCovers = [];
      const { path } = await uploadPdfBufferToStorage(pdfBuffer);
      user.createdCovers.push({
        title: `${user.fullName}-${Date.now()}-cover.pdf`,
        url: path,
      });
      user.canDownloadCover = false;
      await user.save();

      // Send file
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
      });

      return res.send(pdfBuffer);
    } else {
      return res
        .status(400)
        .json({ message: "Cover Letter can be downloaded after payment" });
    }
  } catch (err) {
    console.log("❌ Error downloading: ", err);
    return res.status(500).json({ message: "Error downloading : " + err });
  }
};

export {
  calculateTotalSubscriptionEarning,
  createPaymentIntents,
  cancelAutoRenewl,
  checkFreelancerPayoutSattus,
  createFreelancerPayout,
  checkPaidForResume,
  checkPaidForCoverLetter,
  downLoadResume,
  downLoadCover,
  verifyStripePaymentInetnt,
  ResumeAutoRenewlSusbcription,
};
