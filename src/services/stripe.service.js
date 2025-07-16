import Stripe from "stripe";
import dotenv from "dotenv";
import Order from "../database/models/order.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import { getMemorySubscriptionns } from "../controllers/subscriptions.controller.js";

dotenv.config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createStripeExpressAcount = async (email) => {
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: email,
    capabilities: {
      card_payments: {
        requested: true,
      },
      transfers: {
        requested: true,
      },
    },
  });
  return account;
};

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

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    if (event.type == "charge.succeeded") {
      // update order status
      const intent = event.data.object;
      const order = await Order.findOne({ intentId: intent.payment_intent });
      if (
        order &&
        order.status === "payment_pending" &&
        order.paymentStatus === "payment_pending"
      ) {
        order.status = "in_progress";
        order.paymentStatus = "escrow_held";
        await order.save();
      }
      return res.status(302).redirect("/order/confirmed");
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const sessionId = session.id;

      // handle later
    }

    if (
      event.type === "checkout.session.completed" &&
      event.data.object.payment_status === "paid"
    ) {
      const session = event.data.object;
      const sessionId = session.id;
      const metadata = session.metadata;
      const purpose = metadata.purpose;
      const stripeSubscriptionId =
        session?.subscription ||
        session?.parent?.subscription_details?.subscription;

      // confirm subscription
      if (purpose === "profile-subscription") {
        const transactionId = metadata.transactionId;
        if (!transactionId) {
          console.error("🚫 Missing transactionId in metadata");
          return res.status(200).json({ received: true });
        }

        // check for transaction
        const transaction = await TRANSACTION.findById(transactionId);
        if (!transaction) {
          console.error("❌ Transaction not found");
          return res.status(200).json({ received: true });
        }
        if (transaction.subscriptionDetails.sessionId === sessionId) {
          console.log("⚠️ Session already processed");
          return res.status(200).json({ received: true });
        }
        transaction.subscriptionDetails.status = "completed";
        transaction.subscriptionDetails.sessionId = sessionId;
        transaction.stripeSubscriptionId = stripeSubscriptionId
        await transaction.save();

        // get susbscription
        const subscriptionId = metadata.subscriptionId;
        const subscriptions = await getMemorySubscriptionns();
        const requestedSubscription = subscriptions.find(
          (e) => e._id.toString() === subscriptionId
        );
        if (!requestedSubscription) {
          console.error("❌ Local Subscription not found");
          return res.status(200).json({ received: true });
        }

        // validate user
        const userId = transaction.subscriptionDetails.userId;
        const user = await EMPLOYER.findById(userId);
        if (!user) {
          console.error("❌ User not found!");
          return res.status(200).json({ received: true });
        }

        // add subsription to user
        if (requestedSubscription.mode == "subscription") {
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
        }
        // update oneTimeCreate in user when susbscription mode is oneTime
        else if (requestedSubscription.mode == "oneTime") {
          user.oneTimeCreate = true;
        }
        user.stripeCustomerId = session.customer;
        user.stripeProfileSubscriptionId = session.subscription;
        await user.save();

        return res
          .status(200)
          .json({ message: "Subscription successfull", received: true });
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_create") {
        console.log("📦 Skipping initial subscription creation invoice");
        return res.status(200).json({ received: true });
      }

      console.log("....................................");
      console.log("....................................");
      console.log("....................................");
      console.log(invoice);
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
};
