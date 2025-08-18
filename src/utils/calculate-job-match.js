function calculateJobMatchPercentage(job, user) {
  try {
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

    const skillScore =
      skillWords.size > 0 ? (skillMatches / skillWords.size) * 0.7 : 0;

    const bioScore =
      bioWords.size > 0 ? (bioMatches / bioWords.size) * 0.3 : 0;

    const finalScore = Math.min(
      100,
      Math.round((skillScore + bioScore) * 100)
    );

    return isNaN(finalScore) ? 0 : finalScore;
  } catch (err) {
    console.error("Error calculating match:", err);
    return 0;
  }
}

export default calculateJobMatchPercentage;
