import { z } from "zod";
import SUBSCRIPTIONS_PLANS from "../database/models/subscriptions.model.js";
import mongoose from "mongoose";
import EMPLOYER from "../database/models/employers.model.js";
import {
  createStripeProduct,
  createStripePrice,
  generateStripeCheckoutSubscription,
  genrateStripeCheckoutSession,
  getStripeSubscription,
  updateNewPriceToStripeSubscription,
} from "../services/stripe.service.js";
import TRANSACTION from "../database/models/transactions.model.js";
import getDateNDaysFromNow from "../utils/date-and-days.js";

// store susbscriptions in-memory as they will not be updated frequently
let subscriptions = null;
async function getMemorySubscriptionns() {
  try {
    if (!subscriptions) {
      subscriptions = await SUBSCRIPTIONS_PLANS.find();
    }
  } catch (err) {
    console.log("❌ Error loading memory subscription: ", err);
  } finally {
    return subscriptions;
  }
}
async function updateMemorySubscriptions() {
  subscriptions = null;
}

// Add subscription
const createSubscriptionZODSchema = z.object({
  name: z.string().min(2, "Min 2 chracters required for name"),
  description: z
    .string()
    .min(10, "Min 10 chracters required")
    .max(500, "Max 500 chracters allowed"),
  price: z.number().min(0, "price cannt be less than 0"),
  interval: z.enum(["day", "week", "month", "year"]),
  interval_count: z.number().min(1, "Min interval count is 1"),
  mode: z.enum(["subscription", "oneTime", "free", "resume", "cover"]),
});
const createSubscription = async (req, res) => {
  const data = createSubscriptionZODSchema.parse(req.body);
  try {
    const subscription = await SUBSCRIPTIONS_PLANS.findOne({ name: data.name });
    if (subscription) {
      return res
        .status(400)
        .json({ message: "A subscription with same name already exists" });
    }

    // Mode = Subscriptions
    if (data.mode == "subscription") {
      const subsriptionsCount = await SUBSCRIPTIONS_PLANS.countDocuments({
        mode: "subscription",
      });
      if (subsriptionsCount >= 3) {
        return res
          .status(403)
          .json({ message: "Only 3 plans are supported in subscription mode" });
      }
      const product = await createStripeProduct(data.name, data.description);
      if (!product) {
        return res.status(500).json({ message: "Server Error" });
      }
      const price = await createStripePrice(
        data.price,
        data.interval,
        data.interval_count,
        product.id
      );
      if (!price) {
        return res.status(500).json({ message: "Server Error" });
      }
      data.stripeProductId = product.id;
      data.stripePriceId = price.id;
    }
    // Mode = One Time
    else if (data.mode === "oneTime") {
      const subsriptionsCount = await SUBSCRIPTIONS_PLANS.countDocuments({
        mode: "oneTime",
      });
      if (subsriptionsCount >= 1) {
        return res
          .status(403)
          .json({ message: "Only 1 plan is supported in oneTime mode" });
      }
      const product = await createStripeProduct(data.name, data.description);
      if (!product) {
        return res.status(500).json({ message: "Server Error" });
      }
      const price = await createStripePrice(data.price, null, null, product.id);
      if (!price) {
        return res.status(500).json({ message: "Server Error" });
      }
      data.stripeProductId = product.id;
      data.stripePriceId = price.id;
    }
    // Free subscription
    else if (data.mode == "free") {
      const subsriptionsCount = await SUBSCRIPTIONS_PLANS.countDocuments({
        mode: "free",
      });
      if (subsriptionsCount >= 1) {
        return res
          .status(403)
          .json({ message: "Only 1 plan is supported in free mode" });
      }
      data.stripeProductId = "";
      data.stripePriceId = "";
    }
    // Mode = Resume
    else if (data.mode == "resume") {
      const subsriptionsCount = await SUBSCRIPTIONS_PLANS.countDocuments({
        mode: "resume",
      });
      if (subsriptionsCount >= 1) {
        return res
          .status(403)
          .json({ message: "Only 1 plan is supported in Resume mode" });
      }
      const product = await createStripeProduct(data.name, data.description);
      if (!product) {
        return res.status(500).json({ message: "Server Error" });
      }
      const price = await createStripePrice(data.price, null, null, product.id);
      if (!price) {
        return res.status(500).json({ message: "Server Error" });
      }
      data.stripeProductId = product.id;
      data.stripePriceId = price.id;
    }

    // Mode = cover
    else if (data.mode == "cover") {
      const subsriptionsCount = await SUBSCRIPTIONS_PLANS.countDocuments({
        mode: "cover",
      });
      if (subsriptionsCount >= 1) {
        return res
          .status(403)
          .json({ message: "Only 1 plan is supported in Cover mode" });
      }
      const product = await createStripeProduct(data.name, data.description);
      if (!product) {
        return res.status(500).json({ message: "Server Error" });
      }
      const price = await createStripePrice(data.price, null, null, product.id);
      if (!price) {
        return res.status(500).json({ message: "Server Error" });
      }
      data.stripeProductId = product.id;
      data.stripePriceId = price.id;
    }

    let totalDays = 0;
    switch (data.interval) {
      case "day":
        totalDays = 1 * data.interval_count;
        break;
      case "month":
        totalDays = 30 * data.interval_count;
        break;
      case "week":
        totalDays = 7 * data.interval_count;
        break;
      case "year":
        totalDays = 365 * data.interval_count;
        break;
      default:
        break;
    }

    data.totalDays = totalDays;

    const newSubscription = new SUBSCRIPTIONS_PLANS(data);
    await newSubscription.save();
    updateMemorySubscriptions();

    return res.status(201).json({
      message: "Subscription created successfully",
      subscription: newSubscription._id,
    });
  } catch (err) {
    console.log("❌ Error creating subscription: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const enableProfileFreeTrial = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user", success: false });
    }

    const subscriptions = await getMemorySubscriptionns();
    if (!subscriptions) {
      return res
        .status(404)
        .json({ message: "No subscriptions found", success: false });
    }

    const freeTrial = subscriptions.find(
      (e) => e.mode === "free" && e.isActive === true
    );
    if (!freeTrial) {
      return res
        .status(400)
        .json({ message: "Free trial not available", success: false });
    }

    const user = await EMPLOYER.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "user not found!", success: false });
    }

    if (user.freeTrial.availed == true) {
      return res
        .status(403)
        .json({ message: "Free trial already availed", success: false });
    }

    const now = new Date();
    user.freeTrial = {
      availed: true,
      start: now,
      end: getDateNDaysFromNow(freeTrial.totalDays),
    };

    await user.save();
    return res
      .status(200)
      .json({ message: "Free trial enabled", success: true });
  } catch (err) {
    console.log("❌ Error enable free trial: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const enableProfileSubscription = async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = req.user?._id;

    // IDs validation
    if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({ message: "Invalid subscription Id" });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    // subscription validation
    const subscriptions = await getMemorySubscriptionns();
    if (!subscriptions) {
      return res
        .status(500)
        .json({ message: "Failed to retrive subscriptions" });
    }
    const requestedSubscription = subscriptions.find(
      (e) => e._id.toString() === subscriptionId.toString()
    );
    if (!requestedSubscription) {
      return res.status(404).json({ message: "No subscription found" });
    }
    if (requestedSubscription.isActive == false) {
      return res.status(400).json({ message: "Subscription paused" });
    }

    // user validation
    const user = await EMPLOYER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(404).json({ message: "User not found!" });
    }
    if (user.status == "suspended") {
      return res
        .status(403)
        .json({ message: "Suspendedd accounts cannot get subscriptions" });
    }

    // create transaction
    const transaction = new TRANSACTION({
      mode: "profile-subscription",
      subscriptionDetails: {
        subscriptionId: requestedSubscription._id,
        userId: user._id,
      },
    });

    // process to create stripe checkout to subscribe to new offer
    let url = "";

    // create subscriptio if mode = subscription
    if (requestedSubscription.mode == "subscription") {
      const checkout = await generateStripeCheckoutSubscription(
        user.email,
        requestedSubscription.stripePriceId,
        {
          purpose: "profile-subscription",
          userId: user._id.toString(),
          subscriptionId: requestedSubscription._id.toString(),
          userRole: "employer",
          transactionId: transaction._id.toString(),
        }
      );
      url = checkout.url;
    } else if (requestedSubscription.mode == "oneTime") {
      console.log("--------------> Requested subscription");
      console.log(requestedSubscription);
      const checkout = await genrateStripeCheckoutSession(
        user.email,
        requestedSubscription.stripePriceId,
        {
          purpose: "profile-subscription",
          userId: user._id.toString(),
          subscriptionId: requestedSubscription._id.toString(),
          userRole: "employer",
          transactionId: transaction._id.toString(),
        }
      );
      url = checkout.url;
    }

    if (!url || url == "") {
      return res.status(500).json({ message: "Error generting url" });
    }
    await transaction.save();

    return res.status(200).json({ url });
  } catch (err) {
    console.log("❌ Error getting subscription: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getALlProfileSubsriptions = async (req, res) => {
  try {
    //  for can be freelancer or employer
    // freelancer have resume and cover
    // employer have one time, freetrialand subscription

    const subFor = req.query.for || "employer";

    const subscriptions = (await getMemorySubscriptionns()) || [];
    const filteredSubs =
      subFor == "employer"
        ? subscriptions.filter((e) =>
            ["subscription", "oneTime", "free"].includes(e.mode)
          )
        : subscriptions.filter((e) => ["resume", "cover"].includes(e.mode));

    const sortedSubs = filteredSubs.sort((a, b) => {
      return a.price - b.price;
    });

    return res.status(200).json({ subscriptions: sortedSubs });
  } catch (err) {
    console.log("❌ Error loading subscriptiptions: ", err);
    return res.status(500).json({ message: "Error loading subscriptiptions" });
  }
};

const updateProfileSubscriptions = async (req, res) => {
  try {
    const updates = req.body || [];
    if (!updates || updates.length === 0) {
      return res.status(200).json({ message: "No Updates" });
    }

    const memorySubs = await getMemorySubscriptionns(); // existing subs from DB
    if (!memorySubs || memorySubs.length === 0) {
      return res.status(404).json({ message: "No subscriptions found in DB" });
    }

    for (const newSub of updates) {
      const currentSub = memorySubs.find((el) => el._id == newSub._id);
      if (!currentSub) continue;

      let updateFields = {};

      // Check if price changed
      if (currentSub.price !== newSub.price) {
        // create new price
        let priceObj = null;

        // if mode is subscription
        if (currentSub.mode == "subscription") {
          priceObj = await createStripePrice(
            newSub.price,
            currentSub.interval,
            currentSub.interval_count,
            currentSub.stripeProductId
          );
        } else if (
          currentSub.mode == "oneTime" ||
          currentSub.mode == "resume" ||
          currentSub.mode == "cover"
        ) {
          priceObj = await createStripePrice(
            newSub.price,
            null,
            null,
            currentSub.stripeProductId
          );
        }

        if (!priceObj?.id) {
          console.error("Stripe price creation failed");
          return res
            .status(500)
            .json({ message: "Failed to update Stripe price" });
        }

        updateFields.price = newSub.price;
        updateFields.stripePriceId = priceObj.id;
      }

      // Check if isActive changed
      if (currentSub.isActive !== newSub.isActive) {
        updateFields.isActive = newSub.isActive;
      }

      // Update only if something changed
      if (Object.keys(updateFields).length > 0) {
        await SUBSCRIPTIONS_PLANS.findByIdAndUpdate(currentSub._id, {
          $set: updateFields,
        });

        await updateMemorySubscriptions();
      }
    }

    return res
      .status(200)
      .json({ message: "Subscriptions updated successfully" });
  } catch (err) {
    console.log("❌ Error updating profile subscription: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};
export {
  getMemorySubscriptionns,
  updateMemorySubscriptions,
  createSubscription,
  enableProfileSubscription,
  getALlProfileSubsriptions,
  enableProfileFreeTrial,
  updateProfileSubscriptions,
};
