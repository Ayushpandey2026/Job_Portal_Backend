import { computeSemanticSimilarity } from "./embeddingService.js";
import { matchKeywords, generateSuggestions } from "./keywordService.js";

/**
 * ATS Service - Main orchestrator
 * Combines semantic similarity and keyword matching for ATS score calculation
 */

/**
 * Calculate final ATS score
 * Formula: (0.6 * semanticScore) + (0.4 * keywordScore)
 *
 * Both scores are normalized to 0-100
 *
 * @param {number} semanticScore - Score from embedding similarity (0-100)
 * @param {number} keywordScore - Score from keyword matching (0-100)
 * @returns {number} Final ATS score (0-100)
 */
function calculateFinalScore(semanticScore, keywordScore) {
  const finalScore =
    semanticScore * 0.6 + keywordScore * 0.4;

  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Generate grade based on score
 * @param {number} score - ATS score (0-100)
 * @returns {Object} Grade information
 */
function gradeScore(score) {
  if (score >= 85) {
    return {
      grade: "A+",
      level: "Excellent Match",
      description: "Highly suitable for this position",
    };
  } else if (score >= 75) {
    return {
      grade: "A",
      level: "Very Good Match",
      description: "Well-suited for this position",
    };
  } else if (score >= 65) {
    return {
      grade: "B",
      level: "Good Match",
      description: "Reasonably suitable for this position",
    };
  } else if (score >= 50) {
    return {
      grade: "C",
      level: "Fair Match",
      description: "Some alignment with requirements",
    };
  } else if (score >= 35) {
    return {
      grade: "D",
      level: "Poor Match",
      description: "Significant skill gaps",
    };
  } else {
    return {
      grade: "F",
      level: "Not Suitable",
      description: "Does not meet minimum requirements",
    };
  }
}

/**
 * Calculate readiness index
 * Determines how "resume-ready" the candidate is
 *
 * @param {number} score - Final ATS score
 * @param {number} matchPercentage - Percentage of skills matched
 * @returns {Object} Readiness information
 */
function calculateReadiness(score, matchPercentage) {
  const readinessScore = (score * 0.7) + (matchPercentage * 0.3);

  return {
    readinessScore: Math.round(readinessScore),
    readiness:
      readinessScore >= 80
        ? "Ready to Apply"
        : "Consider Improvement",
  };
}

/**
 * Main ATS matching function
 * Orchestrates all services to produce final ATS score and insights
 *
 * @param {Object} resumeParsed - Parsed resume data { skills, experience, education, rawText }
 * @param {Object} jdParsed - Parsed job description data { skills, experience, education, rawText }
 * @returns {Promise<Object>} Complete ATS analysis result
 */
export const performATSMatching = async (resumeParsed, jdParsed) => {
  try {
    console.log("Starting ATS matching process...");

    if (!resumeParsed || !jdParsed) {
      throw new Error("Resume and JD parsed data required");
    }

    // Get resume and JD text for semantic matching
    // Use full rawText for better diversity in scoring, not just summary
    const resumeText = resumeParsed.rawText || resumeParsed.summary || "";
    const jdText = jdParsed.rawText || jdParsed.summary || "";

    if (!resumeText || !jdText) {
      throw new Error("Resume and JD text cannot be empty");
    }

    // Log text lengths for debugging
    console.log(`Resume text length: ${resumeText.length} characters`);
    console.log(`JD text length: ${jdText.length} characters`);

    console.log("Step 1: Computing semantic similarity...");
    const semanticResult = await computeSemanticSimilarity(resumeText, jdText);
    const semanticScore = semanticResult.semanticScore;

    console.log("Step 2: Matching keywords...");
    const keywordResult = await matchKeywords(resumeParsed, jdParsed);
    const keywordScore = keywordResult.keywordScore;

    console.log("Step 3: Calculating final score...");
    const finalScore = calculateFinalScore(semanticScore, keywordScore);

    console.log("Step 4: Generating suggestions...");
    const suggestions = generateSuggestions(
      keywordResult.missingSkills,
      resumeText
    );

    console.log("Step 5: Grading and readiness assessment...");
    const gradeInfo = gradeScore(finalScore);
    const readinessInfo = calculateReadiness(
      finalScore,
      parseFloat(keywordResult.matchPercentage)
    );

    // Compile final result
    const result = {
      finalScore: Math.round(finalScore * 100) / 100,
      grade: gradeInfo.grade,
      level: gradeInfo.level,
      description: gradeInfo.description,
      readiness: readinessInfo.readiness,
      readinessScore: readinessInfo.readinessScore,

      // Detailed scores
      semanticScore: Math.round(semanticScore * 100) / 100,
      keywordScore: Math.round(keywordScore * 100) / 100,

      // Skill analysis
      matchedSkills: keywordResult.matchedSkills,
      missingSkills: keywordResult.missingSkills,
      matchedCount: keywordResult.matchedCount,
      totalRequired: keywordResult.totalRequired,
      matchPercentage: keywordResult.matchPercentage,

      // Suggestions
      suggestions: suggestions,

      // Additional insights
      insights: generateInsights(
        finalScore,
        keywordResult,
        semanticScore,
        resumeParsed,
        jdParsed
      ),

      // Timestamp
      generatedAt: new Date(),
    };

    console.log(
      `ATS matching complete. Final Score: ${result.finalScore}/100 (${result.grade})`
    );

    return result;
  } catch (error) {
    console.error("Error in performATSMatching:", error);
    throw new Error(`ATS matching failed: ${error.message}`);
  }
};

/**
 * Generate detailed insights from matching results
 *
 * @private
 */
function generateInsights(
  finalScore,
  keywordResult,
  semanticScore,
  resumeParsed,
  jdParsed
) {
  const insights = [];

  // Semantic match insight
  if (semanticScore >= 75) {
    insights.push({
      type: "strength",
      area: "Semantic Alignment",
      message:
        "Your resume content strongly aligns with the job description semantically.",
    });
  } else if (semanticScore < 50) {
    insights.push({
      type: "weakness",
      area: "Semantic Alignment",
      message:
        "Consider restructuring your resume to better reflect the job requirements.",
    });
  }

  // Keyword match insight
  const matchPercentage = parseFloat(keywordResult.matchPercentage);
  if (matchPercentage >= 80) {
    insights.push({
      type: "strength",
      area: "Skill Match",
      message: `Excellent: ${matchPercentage}% of required skills are present.`,
    });
  } else if (matchPercentage >= 60) {
    insights.push({
      type: "neutral",
      area: "Skill Match",
      message: `Fair: ${matchPercentage}% of required skills are present. Missing skills can be learned.`,
    });
  } else {
    insights.push({
      type: "weakness",
      area: "Skill Gap",
      message: `Only ${matchPercentage}% of required skills present. Significant upskilling may be needed.`,
    });
  }

  // Experience insight
  const resumeExperienceCount = (resumeParsed.experience || []).length;
  const jdExperienceCount = (jdParsed.experience || []).length;

  if (resumeExperienceCount === 0) {
    insights.push({
      type: "warning",
      area: "Experience",
      message:
        "No experience entries detected in your resume. Add work history details.",
    });
  }

  // Education insight
  const resumeEducationCount = (resumeParsed.education || []).length;

  if (resumeEducationCount === 0) {
    insights.push({
      type: "warning",
      area: "Education",
      message:
        "No education entries detected. Add your educational qualifications.",
    });
  }

  // Skill gap breakdown
  if (
    keywordResult.missingSkills.length > 0 &&
    keywordResult.missingSkills.length <= 5
  ) {
    insights.push({
      type: "actionable",
      area: "Quick Wins",
      message: `You're close! Adding these ${keywordResult.missingSkills.length} skills could significantly boost your score: ${keywordResult.missingSkills.slice(0, 3).join(", ")}`,
    });
  }

  // Overall recommendation
  if (finalScore >= 85) {
    insights.push({
      type: "positive",
      area: "Recommendation",
      message: "This is an excellent match. You should apply immediately!",
    });
  } else if (finalScore >= 65) {
    insights.push({
      type: "neutral",
      area: "Recommendation",
      message:
        "This is a decent match. Apply but consider highlighting relevant skills.",
    });
  } else if (finalScore >= 50) {
    insights.push({
      type: "caution",
      area: "Recommendation",
      message:
        "Moderate skill gaps detected. Focus on learning missing skills before applying.",
    });
  } else {
    insights.push({
      type: "negative",
      area: "Recommendation",
      message:
        "Significant gaps between your profile and job requirements. Not recommended for application.",
    });
  }

  return insights;
}

export default {
  performATSMatching,
  gradeScore,
  calculateReadiness,
};
