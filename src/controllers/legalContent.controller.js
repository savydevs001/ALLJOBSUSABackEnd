import LEGAL_CONTENT from "../database/models/legalContent.model.js";
import {
  sendPolicyUpdatedToMails,
  sendRulesUpdatedToMails,
  sendTermsUpdatedToMails,
} from "../services/emailSender.js";

let lagalContent = {
  privacy: undefined,
  terms: undefined,
  transparency: undefined,
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
    if (!lagalContent.transparency) {
      const data = await LEGAL_CONTENT.findOne({ type: "transparency" });
      lagalContent.transparency = data;
      return data;
    } else {
      return lagalContent.transparency;
    }
  } catch (err) {
    console.log("❌ Error Loading transparency from database");
  }
};

const getLegalContent = async (req, res) => {
  try {
    const { type } = req.params; // "privacy", "terms", "transparency"
    if (!["privacy", "terms", "transparency"].includes(type)) {
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
      case "transparency":
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
    const notify = req.query.notify?.toString() == "true" ? true : false;

    if (!["privacy", "terms", "transparency"].includes(type)) {
      return res.status(400).json({ message: "Invalid Type" });
    }

    const updated = await LEGAL_CONTENT.findOneAndUpdate(
      { type },
      { content, updatedAt: new Date() },
      { new: true, upsert: true } // create if not exists
    );

    console.log("query: ", req.query);
    console.log("notify: ", notify);

    switch (type) {
      case "privacy":
        lagalContent.privacy = undefined;
        if (notify == true) {
          await sendPolicyUpdatedToMails();
        }
        break;
      case "terms":
        lagalContent.terms = undefined;
        if (notify == true) {
          await sendTermsUpdatedToMails();
        }
        break;
      case "transparency":
        lagalContent.transparency = undefined;
        await sendRulesUpdatedToMails();
        break;
      default:
        break;
    }

    return res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating legal content:", err);
    return res.status(500).json({ message: "Server error", err: err.message });
  }
};

export { getLegalContent, updateContent };
