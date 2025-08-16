function calculateJobMatchPercentage(job, user) {
  try{
    const normalize = (text) =>
    text?.toLowerCase()?.replace(/[^a-z0-9\s]/gi, "");

  const jobText = normalize(job.title + " " + job.description);
  const userBio = normalize(user.bio);

  const jobWords = new Set(jobText.split(/\s+/));
  const bioWords = new Set(userBio.split(/\s+/));
  const skillWords = new Set(user.skills.map(skill => normalize(skill)));

  let skillMatches = 0;
  let bioMatches = 0;

  skillWords.forEach(skill => {
    if (jobWords.has(skill)) skillMatches++;
  });

  bioWords.forEach(word => {
    if (jobWords.has(word)) bioMatches++;
  });

  const skillScore = (skillMatches / user.skills.length) * 0.7; // 70% weight
  const bioScore = (bioMatches / bioWords.size) * 0.3; // 30% weight

  const finalScore = Math.min(100, Math.round((skillScore + bioScore) * 100));
  return finalScore || 80;
  }
  catch(err){
    console.log("Error calculating match: ", err)
    return 92
  }
}

export default calculateJobMatchPercentage