function calculateJobMatchPercentage(job, user) {
  try {
    const jobCategory = job.category;
    const userCategory = user.category;
    
    const normalize = (text) =>
      (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, "")
        .trim();

    const jobText = normalize(`${job.title || ""} ${job.description || ""}`);
    const userBio = normalize(user.bio || "");

    const jobWords = new Set(jobText.split(/\s+/).filter(Boolean));
    const bioWords = new Set(userBio.split(/\s+/).filter(Boolean));
    const skillWords = new Set(
      (user.skills || []).map((skill) => normalize(skill)).filter(Boolean)
    );

    let skillMatches = 0;
    let bioMatches = 0;

    skillWords.forEach((skill) => {
      if (jobWords.has(skill)) skillMatches++;
    });

    bioWords.forEach((word) => {
      if (jobWords.has(word)) bioMatches++;
    });

    // ✅ Category score (50% weight)
    const categoryMatch =
      normalize(jobCategory) && normalize(userCategory)
        ? normalize(jobCategory) === normalize(userCategory)
          ? 1
          : 0
        : 0;
    const categoryScore = categoryMatch * 0.5;

    // ✅ Skills score (35% of total)
    const skillScore =
      skillWords.size > 0 ? (skillMatches / skillWords.size) * 0.35 : 0;

    // ✅ Bio score (15% of total)
    const bioScore =
      bioWords.size > 0 ? (bioMatches / bioWords.size) * 0.15 : 0;

    const finalScore = Math.min(
      100,
      Math.round((categoryScore + skillScore + bioScore) * 100)
    );

    console.log("mamtc: ", isNaN(finalScore) ? 0 : finalScore)
    return isNaN(finalScore) ? 0 : finalScore;
  } catch (err) {
    console.error("Error calculating match:", err);
    return 0;
  }
}

export default calculateJobMatchPercentage;
