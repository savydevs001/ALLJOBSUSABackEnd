import PlatformSettings from "../database/models/palteform.model.js";

const createPllateformSettings = async (req, res) => {
  try {
    const data = {
      pricing: {
        platformCommissionPercentage: 20,
        platformCommissionPercentageActive: true,
        platformCommissionPercentageForNonFreelancers: 3,
        platformCommissionPercentageForNonFreelancersActive: true,
      },
    };
    const count = await PlatformSettings.countDocuments({});
    if (count > 0) {
      console.log("Plateform settings already present");
      return;
    }

    await PlatformSettings.create(data);
    console.log("Plateform settings created successfully");
  } catch (err) {
    console.log("Error creating settings: ", err);
  }
};
setTimeout(() => {
  createPllateformSettings();
}, [10_000]);

const updatePlateformCommision = async (req, res) => {
  try {
    const data = req.body;
    console.log("data: ", data);
    if (
      !data ||
      !data._id ||
      data.price === undefined ||
      data.isActive === undefined ||
      data.nonFreelancerPrice === undefined ||
      data.nonFreelancerIsActive === undefined
    ) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const platfoem = await PlatformSettings.findById(data._id);
    if (!platfoem) {
      return res.status(400).json({ message: "Invalid request" });
    }

    platfoem.pricing.platformCommissionPercentage = Number(data.price);
    platfoem.pricing.platformCommissionPercentageActive = Boolean(
      data.isActive
    );
    platfoem.pricing.platformCommissionPercentageForNonFreelancers = Number(
      data.nonFreelancerPrice
    );
    platfoem.pricing.platformCommissionPercentageForNonFreelancersActive =
      Boolean(data.nonFreelancerIsActive);
    await platfoem.save();

    return res.status(200).json({ message: "Details updated" });
  } catch (err) {
    console.log("Error updating plateform commisionn: ", err);
    return res
      .status(500)
      .json({ message: "Error updating data", err: err.message });
  }
};

const getPlateformCommission = async (req, res) => {
  try {
    const commision = (await PlatformSettings.find({}))[0];

    const data = {
      _id: commision._id,
      name: "Plateform Comission",
      description: "Commision Percentage Per Oder",
      price: commision.pricing.platformCommissionPercentage,
      isActive: commision.pricing.platformCommissionPercentageActive,
      nonFreelancerPrice:
        commision.pricing.platformCommissionPercentageForNonFreelancers || 0,
      nonFreelancerisActive:
        commision.pricing.platformCommissionPercentageForNonFreelancersActive ||
        false,
      mode: "plateform",
    };

    return res.status(200).json({ data });
  } catch (err) {
    console.log("Error  getting plateform commisionn: ", err);
    return res.status(500).json({ message: "Server Errrr" });
  }
};

const getHomePageAd = async (req, res) => {
  try {
    const setting = (await PlatformSettings.find({}))[0];

    if (!setting) {
      return res.status(404).json({ message: "Not found" });
    }

    const ad = setting.homePageAd;
    return res.status(200).json({ ad });
  } catch (err) {
    console.log("Error  getting homepage ad: ", err);
    return res.status(500).json({ message: "Server Errrr" });
  }
};

const setHomePageAd = async (req, res) => {
  try {
    const data = req.body;
    if (
      data == undefined ||
      data.imageUrl == undefined ||
      data.targetUrl == undefined ||
      data.isActive == undefined
    ) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const setting = (await PlatformSettings.find({}))[0];
    if (!setting) {
      return res.status(404).json({ message: "Not found" });
    }

    setting.homePageAd = {
      imageUrl: data.imageUrl,
      targetUrl: data.targetUrl,
      isActive: data.isActive,
    };

    await setting.save();

    return res.status(200).json({ message: "Updated successfully" });
  } catch (err) {
    console.log("Error  getting plateform commisionn: ", err);
    return res.status(500).json({ message: "Server Errrr" });
  }
};
export {
  updatePlateformCommision,
  getPlateformCommission,
  getHomePageAd,
  setHomePageAd,
};
