import Stripe from "stripe";
import dotenv from "dotenv";
import Order from "../database/models/order.model.js";

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

// const generateStripeCheckout = async (email, order) => {
//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ["card"],
//     mode: "payment",
//     customer_email: email,
//     line_items: [
//       {
//         price_data: {
//           currency: "usd",
//           product_data: {
//             name: order.title,
//             description: order.description,
//           },
//           unit_amount: Math.round(order.totalAmount * 100), // in cents
//         },
//         quantity: 1,
//       },
//     ],
//     success_url: `${process.env.FRONTEND_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
//     metadata: {
//       orderId: order._id.toString(),
//       employerId: order.employerId.toString(),
//     },
//   });
//   return session;
// };

const stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    let event;

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const intent = event.data.object;
    switch (event.type) {
      case "charge.succeeded":
        // update order status
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

      case "payment_intent.payment_failed":
        // to be implemented
        break;

      default:
        // do nothing
        break;
    }
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
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

export {
  createStripeExpressAcount,
  generateOnBoardingAccountLink,
  generateStripePaymentIntent,
  relaseFunds,
  getStripeAccountbyId,
  generateStipeLoginLink,
  // generateStripeCheckout,
  stripeWebhook,
  getCapturedIntent,
  getIntentById,
};
