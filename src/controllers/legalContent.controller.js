import LEGAL_CONTENT from "../database/models/legalContent.model.js";

let lagalContent = {
  privacy: undefined,
  terms: undefined,
  careers: undefined,
};

const getPrivacy = async () => {
  try {
    if (!lagalContent.privacy) {
      const data = await LEGAL_CONTENT.findOne({ type: "privacy" });
      lagalContent.privacy = data;
      return data;
    } else {
      return lagalContent.privacy;
    }
  } catch (err) {
    console.log("❌ Error Loading Privacy Policy from database");
  }
};

const getTerms = async () => {
  try {
    if (!lagalContent.terms) {
      const data = await LEGAL_CONTENT.findOne({ type: "terms" });
      lagalContent.terms = data;
      return data;
    } else {
      return lagalContent.terms;
    }
  } catch (err) {
    console.log("❌ Error Loading terms from database");
  }
};

const getCareer = async () => {
  try {
    if (!lagalContent.careers) {
      const data = await LEGAL_CONTENT.findOne({ type: "careers" });
      lagalContent.careers = data;
      return data;
    } else {
      return lagalContent.careers;
    }
  } catch (err) {
    console.log("❌ Error Loading Careers from database");
  }
};

const getLegalContent = async (req, res) => {
  try {
    const { type } = req.params; // "privacy", "terms", "careers"
    if (!["privacy", "terms", "careers"].includes(type)) {
      return res.status(400).json({ message: "Invalid Type" });
    }

    let data;

    switch (type) {
      case "privacy":
        data = await getPrivacy();
        break;
      case "terms":
        data = await getTerms();
        break;
      case "careers":
        data = await getCareer();
        break;
      default:
        break;
    }

    if (!data) {
      return res.status(400).json({ message: "No Data" });
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.log("Error getting legal Content: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const updateContent = async (req, res) => {
  try {
    const { type } = req.params;
    const { content } = req.body;

    if (!["privacy", "terms", "careers"].includes(type)) {
      return res.status(400).json({ message: "Invalid Type" });
    }

    const updated = await LEGAL_CONTENT.findOneAndUpdate(
      { type },
      { content, updatedAt: new Date() },
      { new: true, upsert: true } // create if not exists
    );

    switch (type) {
      case "privacy":
        lagalContent.privacy = undefined;
        break;
      case "terms":
        lagalContent.terms = undefined;
        break;
      case "careers":
        lagalContent.careers = undefined;
        break;
      default:
        break;
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating legal content:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export { getLegalContent, updateContent };
