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
    type: "express",
    country: country,
    email: email,
    business_type,
    capabilities,
    individual,
    tos_acceptance: {
      // ...tos_acceptance,
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
  const link = await stripe.accounts.createLoginLink(stripeAccountId);
  return link;
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
    console.log("isConnect: ", isConnect);
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

    // if (event.type == "charge.succeeded") {
    //   // update order status
    //   const intent = event.data.object;
    //   const order = await Order.findOne({ intentId: intent.payment_intent });
    //   if (
    //     order &&
    //     order.status === "payment_pending" &&
    //     order.paymentStatus === "payment_pending"
    //   ) {
    //     order.status = "in_progress";
    //     order.paymentStatus = "escrow_held";
    //     await order.save();
    //   }
    //   // return res.status(200).redirect("/order/confirmed");
    //   return res
    //     .status(200)
    //     .json({ message: "No Matching condition", received: true });
    // }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const sessionId = session.id;

      // handle later
    }

    // if (event.type === "payment_intent.succeeded") {
    //   const session = event.data.object;
    //   const sessionId = session.id;
    //   const metadata = session.metadata;
    //   const purpose = metadata.purpose;
    //   const stripeSubscriptionId =
    //     session?.subscription ||
    //     session?.parent?.subscription_details?.subscription;

    //   // confirm subscription
    //   if (purpose === "profile-subscription") {
    //     const transactionId = metadata.transactionId;
    //     if (!transactionId) {
    //       console.error("🚫 Missing transactionId in metadata");
    //       return res.status(200).json({ received: true });
    //     }

    //     // check for transaction
    //     const transaction = await TRANSACTION.findById(transactionId);
    //     if (!transaction) {
    //       console.error("❌ Transaction not found");
    //       return res.status(200).json({ received: true });
    //     }
    //     if (transaction.subscriptionDetails.sessionId === sessionId) {
    //       console.log("⚠️ Session already processed");
    //       return res.status(200).json({ received: true });
    //     }
    //     transaction.subscriptionDetails.status = "completed";
    //     transaction.subscriptionDetails.sessionId = sessionId;
    //     transaction.stripeSubscriptionId = stripeSubscriptionId;
    //     await transaction.save();

    //     // get susbscription
    //     const subscriptionId = metadata.subscriptionId;
    //     const subscriptions = await getMemorySubscriptionns();
    //     const requestedSubscription = subscriptions.find(
    //       (e) => e._id.toString() === subscriptionId
    //     );
    //     if (!requestedSubscription) {
    //       console.error("❌ Local Subscription not found");
    //       return res.status(200).json({ received: true });
    //     }

    //     // validate user
    //     const userId = transaction.subscriptionDetails.userId;
    //     const user = await EMPLOYER.findById(userId);
    //     if (!user) {
    //       console.error("❌ User not found!");
    //       return res.status(200).json({ received: true });
    //     }

    //     // add subsription to user
    //     if (requestedSubscription.mode == "subscription") {
    //       const now = new Date();
    //       const tempSub = {
    //         subId: stripeSubscriptionId,
    //         start: now,
    //         end: new Date(
    //           now.getTime() +
    //             requestedSubscription.totalDays * 24 * 60 * 60 * 1000
    //         ),
    //       };
    //       user.currentSubscription = tempSub;
    //       user.usedSessions = [...user.usedSessions, sessionId];
    //       user.pastSubscriptions = [...user.pastSubscriptions, tempSub];
    //     }
    //     // update oneTimeCreate in user when susbscription mode is oneTime
    //     else if (requestedSubscription.mode == "oneTime") {
    //       user.oneTimeCreate = true;
    //     }
    //     user.stripeCustomerId = session.customer;
    //     user.stripeProfileSubscriptionId = session.subscription;
    //     await user.save();

    //     return res
    //       .status(200)
    //       .json({ message: "Subscription successfull", received: true });
    //   } else if (purpose === "order-payment") {
    //     const {
    //       offerId,
    //       transactionId,
    //       employerId,
    //       jobId,
    //       orderId,
    //       freelancerId,
    //     } = metadata;

    //     if (
    //       !offerId ||
    //       !transactionId ||
    //       !employerId ||
    //       !orderId ||
    //       !freelancerId
    //     ) {
    //       throw new Error("Missing metadata in Stripe session");
    //     }

    //     const mongooseSession = await mongoose.startSession();
    //     mongooseSession.startTransaction();

    //     try {
    //       // update offer to accepted
    //       await Offer.findByIdAndUpdate(
    //         offerId,
    //         {
    //           status: "accepted",
    //         },
    //         { session: mongooseSession }
    //       );

    //       // job to filled
    //       if (jobId) {
    //         await Job.findByIdAndUpdate(
    //           jobId,
    //           {
    //             status: "filled",
    //           },
    //           { session: mongooseSession }
    //         );
    //       }

    //       // update order to in_progress
    //       await Order.findByIdAndUpdate(
    //         orderId,
    //         {
    //           status: "in_progress",
    //         },
    //         { session: mongooseSession }
    //       );

    //       // update transaction to success and save stripe session and intent
    //       await TRANSACTION.findByIdAndUpdate(
    //         transactionId,
    //         {
    //           $set: {
    //             "orderDeatils.status": "escrow_held",
    //             "orderDeatils.stripeSessionId": session.id,
    //             "orderDeatils.stripeIntentId": session.payment_intent,
    //           },
    //         },
    //         { session: mongooseSession }
    //       );

    //       //
    //       await mongooseSession.commitTransaction();
    //     } catch (err) {
    //       console.log("❌ Error on making paymet for order: ", err);
    //       await mongooseSession.abortTransaction();
    //     } finally {
    //       mongooseSession.endSession();
    //       return res.status(200).json({ received: true });
    //     }
    //   }
    // }

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
            const now = new Date();
            const tempSub = {
              subId: stripeSubscriptionId,
              start: now,
              end: new Date(
                now.getTime() +
                  requestedSubscription.totalDays * 24 * 60 * 60 * 1000
              ),
            };
            user.currentSubscription = tempSub;
            user.usedSessions = [...user.usedSessions, sessionId];
            user.pastSubscriptions = [...user.pastSubscriptions, tempSub];
          } else if (requestedSubscription.mode === "oneTime") {
            user.oneTimeCreate = true;
          }

          user.stripeCustomerId = session.customer;
          user.stripeProfileSubscriptionId = session.subscription;
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
          await Offer.findByIdAndUpdate(
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
          await Order.findByIdAndUpdate(
            orderId,
            { status: "in_progress" },
            { session: mongooseSession }
          );

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

          await mongooseSession.commitTransaction();
          mongooseSession.endSession();
          console.log("ok: ", session);
          console.log("trasba ", aa);
          return res.status(200).json({ received: true });
        } catch (err) {
          await mongooseSession.abortTransaction();
          mongooseSession.endSession();
          console.error("❌ Error processing order payment:", err);
          return res.status(500).json({ error: "Payment processing failed" });
        }
      }

      // Hnadle resume
      else if (purpose === "resume-payment") {
        const { freelancerId } = metadata;
        console.log("metadata: ", metadata);

        try {
          // Update user to allow download resume
          await FREELANCER.updateOne(
            { _id: freelancerId },
            {
              canDownloadResume: true,
            }
          );

          console.log("ok: ", session);
          return res.status(200).json({ received: true });
        } catch (err) {
          await mongooseSession.abortTransaction();
          mongooseSession.endSession();
          console.error("❌ Error processing resume payment:", err);
          return res.status(500).json({ error: "Payment processing failed" });
        }
      }

      // Handle Cover
      else if (purpose === "cover-payment") {
        const { freelancerId } = metadata;
        console.log("metadata: ", metadata);

        try {
          // Update user to allow download resume
          await FREELANCER.updateOne(
            { _id: freelancerId },
            {
              canDownloadCover: true,
            }
          );

          console.log("ok: ", session);
          return res.status(200).json({ received: true });
        } catch (err) {
          await mongooseSession.abortTransaction();
          mongooseSession.endSession();
          console.error("❌ Error processing resume payment:", err);
          return res.status(500).json({ error: "Payment processing failed" });
        }
      }
    }

    if (event.type === "invoice.payment_succeeded") {
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
            subId: subscriptionId,
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
        console.log("------------------- Failed ----------------");

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
      percentChange,
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
};
