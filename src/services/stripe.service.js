import Stripe from "stripe";
import dotenv from "dotenv";
import Order from "../database/models/order.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import { getMemorySubscriptionns } from "../controllers/subscriptions.controller.js";
import FREELANCER from "../database/models/freelancer.model.js";
import mongoose from "mongoose";
import Offer from "../database/models/offers.model.js";
import Job from "../database/models/jobs.model.js";
import PlatformSettings from "../database/models/palteform.model.js";
import PENDING_PAYOUT from "../database/models/pendingPayout.model.js";
import { notifyUser } from "../controllers/notification.controller.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createStripeExpressAcount = async ({
  email,
  country,
  business_type,
  individual,
  tos_acceptance,
}) => {
  // Determine appropriate service agreement based on country
  const needsRecipientAgreement = !["US"].includes(country);

  // Set up capabilities based on service agreement type
  let capabilities = { transfers: { requested: true } };
  if (needsRecipientAgreement) {
    capabilities = {
      transfers: { requested: true },
    };
  } else {
    capabilities = {
      card_payments: { requested: true },
      transfers: { requested: true },
    };
  }

  // Create the account with appropriate settings
  const account = await stripe.accounts.create({
    type: "custom",
    country: country,
    email: email,
    business_type,
    capabilities,
    individual,
    settings: {
      payouts: {
        schedule: {
          interval: "manual", // Disable automatic payouts
        },
        debit_negative_balances: false, // Optional: Prevent overdrafts
      },
    },
    tos_acceptance: {
      ...tos_acceptance,
      service_agreement: needsRecipientAgreement ? "recipient" : "full",
    },
  });
  return account;
};

// const createStripeExpressAcount = async ({
//   email,
//   country,
//   business_type,
//   individual,
//   tos_acceptance,
// }) => {
//   const account = await stripe.accounts.create({
//     type: "express",
//     country: country,
//     email: email,
//     business_type,
//     capabilities: {
//       // card_payments: {
//       //   requested: true,
//       // },
//       transfers: {
//         requested: true,
//       },
//     },
//     individual,
//     // tos_acceptance,
//   });
//   return account;
// };

const generateOnBoardingAccountLink = async (
  account,
  refresh_url,
  return_url
) => {
  const accountLink = await stripe.accountLinks.create({
    account,
    refresh_url, // re-auth url
    return_url, // on onboarding completion
    type: "account_onboarding",
  });
  return accountLink;
};

const generateStripePaymentIntent = async (amount, orderId, destinationId) => {
  const platformFee = Math.round(amount * 100 * 0.068); // 6.8% fee in cents
  // To capture funds from employer
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "usd",
    capture_method: "manual", // <-- hold funds (authorize only)
    metadata: {
      orderId,
      destinationId,
    },
    application_fee_amount: platformFee, // platform keeps 6.8%
    transfer_data: {
      destination: destinationId, // 90% goes to freelancer
    },
  });
  return paymentIntent;
};

const relaseFunds = async (amount, destination) => {
  const platformFee = Math.round(amount * 0.068); // 6.8%
  const freelancerAmount = amount - platformFee; // ~90%
  const transfer = await stripe.transfers.create({
    amount: freelancerAmount,
    currency: "USD",
    destination,
  });
  return transfer;
};

const createStripeTransfer = async (amount, destination, transfer_group) => {
  const transfer = await stripe.transfers.create({
    amount: amount * 100,
    currency: "usd",
    destination,
    transfer_group,
  });
  return transfer;
};

const getStripeAccountbyId = async (stripeAccountId) => {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  return account;
};

const generateStipeLoginLink = async (stripeAccountId) => {
  // Example for Custom account to update bank details
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: process.env.STRIPE_REFRESH_URL,
    return_url: process.env.STRIPE_RETURN_URL,
    type: "account_update",
    collect: "currently_due",
  });
  return accountLink;
};

const generateStripeCheckoutSubscription = async (
  email,
  stripePriceId,
  metadata
) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL}/stripe/payment?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/stripe/payment/failed`,
    metadata: metadata,
  });
  return session;
};

const genrateStripeCheckoutSession = async (email, priceId, metadata) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: metadata || {},
    success_url: `${process.env.FRONTEND_URL}/stripe/payment/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/stripe/payment/failed`,
  });
  return session;
};

const stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    let event;

    const isConnect = req.query.is_connect;
    // console.log("isConnect: ", isConnect);
    const WEB_HOOK_SECRET = isConnect
      ? process.env.STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET
      : process.env.STRIPE_WEBHOOK_SECRET;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WEB_HOOK_SECRET);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type == "account.updated") {
      const account = event.data.object;
      console.log("-------> Account: ");
      const isReady =
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled;

      if (!isReady) {
        return res.status(200).json({
          message: "Account onboarding is incomplete",
          received: true,
        });
      }
      if (isReady) {
        // Find the user with this Stripe account ID
        const user = await FREELANCER.findOne({ stripeAccountId: account.id });
        if (user && !user.onboarded) {
          user.onboarded = true;
          await user.save();
          console.log(`User ${user._id} has completed onboarding`);

          return res
            .status(200)
            .json({ message: "Onboading successfull", received: true });
        }
      }
      return res
        .status(200)
        .json({ message: "No Matching condition", received: true });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const metadata = paymentIntent.metadata;
      const purpose = metadata.purpose;

      // Create session-like object for backward compatibility
      const session = {
        id: paymentIntent.id, // Using payment intent ID as session ID
        metadata: paymentIntent.metadata,
        subscription:
          paymentIntent.invoice?.subscription || metadata.subscriptionId,
        customer: paymentIntent.customer,
        payment_intent: paymentIntent.id,
        payment_status: "paid",
        parent: paymentIntent.last_payment_error?.payment_method?.id
          ? {
              subscription_details: {
                subscription: paymentIntent.invoice?.subscription,
              },
            }
          : undefined,
      };

      const sessionId = session.id;
      // console.log("inetet:", paymentIntent);
      const stripeSubscriptionId =
        session.subscription ||
        session.parent?.subscription_details?.subscription;

      // Handle subscription payments
      if (purpose === "profile-subscription") {
        try {
          const transactionId = metadata.transactionId;
          if (!transactionId) {
            console.error("🚫 Missing transactionId in metadata");
            return res.status(200).json({ received: true });
          }

          // Check for existing transaction
          const transaction = await TRANSACTION.findById(transactionId);
          if (!transaction) {
            console.error("❌ Transaction not found");
            return res.status(200).json({ received: true });
          }

          // Prevent duplicate processing
          if (
            transaction.subscriptionDetails.paymentIntentId === paymentIntent.id
          ) {
            console.log("⚠️ Payment already processed");
            return res.status(200).json({ received: true });
          }

          // Update transaction record
          transaction.subscriptionDetails.status = "completed";
          transaction.subscriptionDetails.sessionId = sessionId;
          transaction.subscriptionDetails.paymentIntentId = paymentIntent.id;
          transaction.stripeSubscriptionId = stripeSubscriptionId;
          await transaction.save();

          // Get subscription details
          const subscriptionId = metadata.subscriptionId;
          const subscriptions = await getMemorySubscriptionns(); // Your existing function
          const requestedSubscription = subscriptions.find(
            (e) => e._id.toString() === subscriptionId
          );

          if (!requestedSubscription) {
            console.error("❌ Local Subscription not found");
            return res.status(200).json({ received: true });
          }

          // Update user record
          const userId = transaction.subscriptionDetails.userId;
          const user = await EMPLOYER.findById(userId);
          if (!user) {
            console.error("❌ User not found!");
            return res.status(200).json({ received: true });
          }

          if (requestedSubscription.mode === "subscription") {
            // create subscription only when user selected to subscribe
            if (user.susbscriptionRenew == true) {
              const newStripeSubscription = await createStripeSubscription2({
                customerId: paymentIntent.customer,
                priceId: requestedSubscription.stripePriceId,
                paymentMethodId: paymentIntent.payment_method,
                metadata: paymentIntent.metadata,
              });
              user.stripeProfileSubscriptionId = newStripeSubscription.id;
            }
            const now = new Date();
            const tempSub = {
              subId: stripeSubscriptionId,
              start: now,
              end: new Date(
                now.getTime() +
                  requestedSubscription.totalDays * 24 * 60 * 60 * 1000
              ),
            };
            // console.log("newStripeSubscription: ", newStripeSubscription);
            user.currentSubscription = tempSub;
            user.usedSessions = [...user.usedSessions, sessionId];
            user.pastSubscriptions = [...user.pastSubscriptions, tempSub];
          } else if (requestedSubscription.mode === "oneTime") {
            user.oneTimeCreate = true;
          }

          if (!user.stripeCustomerId) {
            user.stripeCustomerId = session.customer;
          }
          await user.save();

          return res
            .status(200)
            .json({ message: "Subscription successful", received: true });
        } catch (err) {
          console.error("❌ Error processing subscription:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
      }

      // Handle order payments
      else if (purpose === "order-payment") {
        const {
          offerId,
          transactionId,
          employerId,
          jobId,
          orderId,
          freelancerId,
        } = metadata;

        if (
          !offerId ||
          !transactionId ||
          !employerId ||
          !orderId ||
          !freelancerId
        ) {
          console.error("❌ Missing required metadata");
          return res.status(400).json({ error: "Missing metadata" });
        }

        const mongooseSession = await mongoose.startSession();
        mongooseSession.startTransaction();

        try {
          // Update offer status
          const offer = await Offer.findByIdAndUpdate(
            offerId,
            { status: "accepted" },
            { session: mongooseSession }
          );

          // Update job status if exists
          if (jobId) {
            await Job.findByIdAndUpdate(
              jobId,
              { status: "filled" },
              { session: mongooseSession }
            );
          }

          // Update order status
          const order = await Order.findByIdAndUpdate(
            orderId,
            { status: "in_progress" },
            { session: mongooseSession }
          ).populate("employerId", "fullName");

          // Update transaction record
          const aa = await TRANSACTION.findByIdAndUpdate(
            transactionId,
            {
              $set: {
                "orderDeatils.status": "escrow_held",
                "orderDeatils.stripeSessionId": session.id,
                "orderDeatils.stripeIntentId": paymentIntent.id,
              },
            },
            { session: mongooseSession }
          );

          await notifyUser(
            {
              userId: freelancerId,
              title: "Offer Accepted",
              message: offer.title,
              from: order.employerId?.fullName || "untitled",
            },
            mongooseSession
          );

          await mongooseSession.commitTransaction();
          mongooseSession.endSession();

          return res.status(200).json({ received: true });
        } catch (err) {
          await mongooseSession.abortTransaction();
          mongooseSession.endSession();
          console.error("❌ Error processing order payment:", err);
          return res.status(500).json({ error: "Payment processing failed" });
        }
      }

      // Handle bonus/tip on order
      else if (purpose === "order-bonus") {
        const { freelancerId, orderId, amount } = metadata;

        if (!amount) {
          return res.status(200).json({
            message: "Missing amount metadata",
            received: true,
          });
        }

        if (
          !mongoose.Types.ObjectId.isValid(freelancerId) ||
          !mongoose.Types.ObjectId.isValid(orderId)
        ) {
          return res.status(200).json({
            message: "Invalid order or freelancer id",
            received: true,
          });
        }

        try {
          const [freelancer, transaction] = await Promise.all([
            FREELANCER.findById(freelancerId),
            TRANSACTION.findOne({ "orderDeatils.orderId": orderId }),
          ]);

          if (!freelancer || !transaction) {
            return res.status(200).json({
              message: "transaction or freelancer not found",
              received: true,
            });
          }

          const mongooseSession = await mongoose.startSession();
          mongooseSession.startTransaction();

          try {
            const totalAmount = amount;
            let companyCut = 0;
            const platformSettings = await PlatformSettings.findOne();

            if (platformSettings?.pricing?.platformCommissionPercentageActive) {
              companyCut = Math.round(
                totalAmount *
                  (platformSettings.pricing.platformCommissionPercentage / 100)
              );
            }

            // Create a pending payout record (delay 7 days)
            const releaseDate = new Date();
            releaseDate.setDate(releaseDate.getDate() + 7);

            const pendingPayout = new PENDING_PAYOUT({
              freelancerId: freelancer._id,
              stripeAccountId: freelancer.stripeAccountId,
              amount: totalAmount - companyCut,
              transferGroup: `order_${orderId}`,
              releaseDate,
              orderId: orderId,
              type: "order_tip",
            });

            // freelancer.tip = freelancer.tip + (totalAmount - companyCut);
            freelancer.pendingClearence = Number(
              (freelancer.pendingClearence || 0) + (totalAmount - companyCut)
            );

            transaction.orderDeatils.tip = Number(
              (transaction.orderDeatils.tip || 0) + (totalAmount - companyCut)
            );

            await pendingPayout.save({ session: mongooseSession });
            await freelancer.save({ session: mongooseSession });
            await transaction.save({ session: mongooseSession });

            await mongooseSession.commitTransaction();
            mongooseSession.endSession();

            return res.status(200).json({
              message: "Bonus processed successfully",
              received: true,
            });
          } catch (err) {
            console.log(
              "Error updating data while updating bonus for order: ",
              orderId + " " + err
            );
            await mongooseSession.abortTransaction();
            mongooseSession.endSession();
            return res.status(200).json({
              message:
                "Payment for bonus processing failed during updating data",
              received: true,
            });
          }
          // create a pending payout
        } catch (err) {
          console.error("❌ Error processing order bonus payment:", err);
          return res.status(200).json({
            message: "Payment for bonus processing failed",
            received: true,
          });
        }
      }

      // Hnadle resume
      else if (purpose === "resume-payment") {
        const { userId, userRole } = metadata;

        try {
          // Update user to allow download resume
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

          user.canDownloadResume = true;
          await user.save();

          return res.status(200).json({ received: true });
        } catch (err) {
          console.error("❌ Error processing resume payment:", err);
          return res
            .status(200)
            .json({ message: "Payment processing failed", received: true });
        }
      }

      // Handle Cover
      else if (purpose === "cover-payment") {
        const { userId, userRole } = metadata;

        try {
          // Update user to allow download cover
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

          user.canDownloadCover = true;
          await user.save();

          return res.status(200).json({ received: true });
        } catch (err) {
          console.error("❌ Error processing cover payment:", err);
          return res
            .status(200)
            .json({ message: "Payment processing failed", received: true });
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      console.log("Invoice created");
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_create") {
        console.log("📦 Skipping initial subscription creation invoice");
        return res.status(200).json({ received: true });
      }

      const stripeCustomer = invoice.customer;

      const subscriptionId =
        invoice?.subscription ||
        invoice?.parent?.subscription_details?.subscription;

      if (!stripeCustomer || !subscriptionId) {
        return res
          .status(200)
          .json({ message: "Missing data", received: true });
      }

      // validate user
      const user = await EMPLOYER.findOne({ stripeCustomerId: stripeCustomer });
      if (!user) {
        console.error("❌ User not found!");
        return res.status(200).json({ received: true });
      }

      // get Account subscription
      const stripeSubscription = await getStripeSubscription(subscriptionId);
      if (!stripeSubscription) {
        console.error("❌ Stripe Subscription not found!");
        return res.status(200).json({ received: true });
      }

      const metadata = stripeSubscription.metadata;
      const purpose = metadata.purpose;

      // update profile subscription
      if (purpose === "profile-subscription") {
        const subscriptions = await getMemorySubscriptionns();
        const requestedSubscription = subscriptions.find(
          (e) => e._id.toString() === metadata.subscriptionId
        );
        if (!requestedSubscription) {
          console.error("❌ invalid requestedSubscription");
          return res.status(200).json({ received: true });
        }

        if (requestedSubscription.mode === "subscription") {
          const now = new Date();
          const tempSub = {
            subId: requestedSubscription._id,
            start: now,
            end: new Date(
              now.getTime() +
                requestedSubscription.totalDays * 24 * 60 * 60 * 1000
            ),
          };
          user.currentSubscription = tempSub;
          user.pastSubscriptions = [...user.pastSubscriptions, tempSub];

          await user.save();

          console.log("------------------- DOne ----------------");
          return res.status(200).json({
            message: "Subscription renewal successful",
            received: true,
          });
        }

        return res
          .status(200)
          .json({ message: "Subscription renewal failed", received: true });
      }
    }
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(200).json({ received: true });
  }
};

const getCapturedIntent = async (intentId) => {
  const intent = await stripe.paymentIntents.capture(intentId);
  return intent;
};

const retriveStripePaymentIntent = async (intentId) => {
  const intent = await stripe.paymentIntents.retrieve(intentId);
  return intent;
};

const getIntentById = async (intentId) => {
  const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
  return paymentIntent;
};

const getStripeSession = async (sessionId) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session;
};

const createStripePrice = async (
  amount,
  interval, // e.g., 'month', 'year', or null
  interval_count, // e.g., 1, 3, etc., or null
  productId
) => {
  const priceConfig = {
    unit_amount: Math.round(amount * 100),
    currency: "usd",
    product: productId,
  };

  if (interval && interval_count) {
    priceConfig.recurring = {
      interval,
      interval_count,
    };
  }

  const price = await stripe.prices.create(priceConfig);
  return price;
};

const createStripeProduct = async (name, description) => {
  const product = await stripe.products.create({ name, description });
  return product;
};

const getStripeSubscription = async (subId) => {
  const subscription = await stripe.subscriptions.retrieve(subId);
  return subscription;
};

const getMonthRange = (year, month) => {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end };
};

const getTotalIncomeAndMonthlyChange = async () => {
  try {
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const { start: currentStart, end: currentEnd } = getMonthRange(
      currentYear,
      currentMonth
    );
    const { start: lastStart, end: lastEnd } = getMonthRange(
      currentYear,
      currentMonth - 1
    );

    let totalIncome = 0;
    let currentMonthIncome = 0;
    let lastMonthIncome = 0;

    // ✅ Await the list() promise before auto-paging
    const invoiceList = await stripe.invoices.list({
      status: "paid",
      limit: 100,
    });

    // 🔁 Handle auto-pagination using autoPagingEach
    await stripe.invoices.list({ status: "paid" }).autoPagingEach((invoice) => {
      const created = new Date(invoice.created * 1000);
      const amount = invoice.amount_paid / 100;

      totalIncome += amount;

      if (created >= currentStart && created < currentEnd) {
        currentMonthIncome += amount;
      } else if (created >= lastStart && created < lastEnd) {
        lastMonthIncome += amount;
      }
    });

    const percentChange =
      lastMonthIncome === 0
        ? currentMonthIncome === 0
          ? 0
          : 100
        : ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100;

    return {
      totalIncome: totalIncome,
      percentChange: percentChange.toFixed(2),
    };
  } catch (err) {
    console.log("Error calculation payments: ", err);
    return null;
  }
};

const updateNewPriceToStripeSubscription = async (subscription, newPriceId) => {
  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id, // Get the item ID to update
        price: newPriceId, // New recurring price ID
      },
    ],
  });

  return updated;
};

const createCheckoutSession = async ({
  successUrl,
  cancelUrl,
  customerEmail,
  amount,
  name,
  description,
  metadata = {},
}) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          product_data: {
            name,
            description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
  return session;
};

const getExternalAccounts = async (accountId) => {
  const [bankAccounts, cardAccounts] = await Promise.all([
    stripe.accounts.listExternalAccounts(accountId, {
      object: "bank_account",
      limit: 100,
    }),
    stripe.accounts.listExternalAccounts(accountId, {
      object: "card",
      limit: 100,
    }),
  ]);
  return { bank: bankAccounts.data, card: cardAccounts.data };
};

const createStripePaymentIntent = async (params) => {
  const intent = await stripe.paymentIntents.create({
    ...params,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
  });
  return intent;
};

const findOrCreateCustomer = async (email) => {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id; // ✅ Found existing
  }

  // Step 2: Create new customer if not found
  const newCustomer = await stripe.customers.create({
    email,
  });

  return newCustomer.id; // ✅ Newly created
};

const getStripeBalanceByAccountId = async (accountId) => {
  const balance = await stripe.balance.retrieve({
    stripeAccount: accountId,
  });
  return balance;
};

const createStripeTransferToPlatform = async (amount, accountId) => {
  const transfer = await stripe.transfers.create(
    {
      amount: amount * 100,
      currency: "usd",
      destination: process.env.PLATFORM_STRIPE_ACCOUNT_ID,
    },
    {
      stripeAccount: accountId, // acts as the source account
    }
  );
  return transfer;
};

const createStripeAccount2 = async (email) => {
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    email: email,
  });
  return account;
};

const createAccountOnbaordSession2 = async (accountId) => {
  const accountSession = await stripe.accountSessions.create({
    account: accountId,
    components: {
      account_onboarding: {
        enabled: true,
      },
    },
  });
  return accountSession;
};

const retriveStripeAccount = async (accountId) => {
  const account = await stripe.accounts.retrieve(accountId);
  return account;
};

const createStripeSubscription2 = async ({
  customerId,
  priceId,
  paymentMethodId,
  metadata,
}) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId, // From the successful payment
    metadata,
  });
  return subscription;
};

const retriveSubscription = async (subId) => {
  const subsscription = await stripe.subscriptions.retrieve(subId);
  return subsscription;
};

const cancelStripeSubscription = async (subId) => {
  const canceledSubscription = await stripe.subscriptions.update(subId, {
    cancel_at_period_end: true,
  });
  return canceledSubscription;
};

const createRefund = async (intentId) => {
  // const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
  // console.log("intent for refund: ", paymentIntent)
  // const chargeId = paymentIntent.charges.data[0].id;
  const refund = await stripe.refunds.create({
    payment_intent: intentId,
  });
  return refund;
};

const createStripePayout = async (amount, accountId) => {
  const payout = await stripe.payouts.create(
    { amount: Math.round(amount * 100), currency: "usd" },
    { stripeAccount: accountId }
  );
  return payout;
};

export {
  createStripeExpressAcount,
  generateOnBoardingAccountLink,
  generateStripePaymentIntent,
  relaseFunds,
  getStripeAccountbyId,
  generateStipeLoginLink,
  stripeWebhook,
  getCapturedIntent,
  getIntentById,
  generateStripeCheckoutSubscription,
  genrateStripeCheckoutSession,
  getStripeSession,
  createStripePrice,
  createStripeProduct,
  getStripeSubscription,
  getTotalIncomeAndMonthlyChange,
  updateNewPriceToStripeSubscription,
  createCheckoutSession,
  retriveStripePaymentIntent,
  createStripeTransfer,
  getExternalAccounts,
  createStripePaymentIntent,
  findOrCreateCustomer,
  getStripeBalanceByAccountId,
  createStripeTransferToPlatform,
  createStripeAccount2,
  createAccountOnbaordSession2,
  retriveStripeAccount,
  createStripeSubscription2,
  retriveSubscription,
  cancelStripeSubscription,
  createRefund,
  createStripePayout,
};
