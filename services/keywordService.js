import Fuse from "fuse.js";
import { compareTwoStrings } from "string-similarity";
import _ from "lodash";

/**
 * Keyword Service for Resume-JD matching
 * Uses Fuse.js for fuzzy matching and string-similarity for scoring
 */

/**
 * Extract keywords from text
 * Filters out common stop words
 *
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Array of keywords
 */
function extractKeywords(text) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "for",
    "if",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "such",
    "that",
    "the",
    "to",
    "was",
    "will",
    "with",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "this",
    "these",
    "that",
    "those",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
    );

  // Remove duplicates and return
  return [...new Set(words)];
}

/**
 * Extract skills from parsed data
 * Combines skills arrays from resume and JD
 *
 * @param {Array} skillsArray - Array of skills from APIs/parser
 * @returns {Array<string>} Unique skills list
 */
function extractSkills(skillsArray) {
  if (!Array.isArray(skillsArray)) return [];

  const skills = skillsArray
    .map((skill) => {
      if (typeof skill === "string") return skill.toLowerCase().trim();
      if (skill.name) return skill.name.toLowerCase().trim();
      return null;
    })
    .filter(Boolean);

  return [...new Set(skills)];
}

/**
 * Fuzzy match skills between resume and JD
 * Uses Fuse.js for approximate matching
 *
 * @param {Array} resumeSkills - Skills extracted from resume
 * @param {Array} jdSkills - Skills required by job description
 * @returns {Object} Matched and unmatched skills with scores
 */
function fuzzyMatchSkills(resumeSkills, jdSkills) {
  if (!Array.isArray(resumeSkills) || !Array.isArray(jdSkills)) {
    return {
      matchedSkills: [],
      missingSkills: [],
      matchedCount: 0,
      totalRequired: 0,
    };
  }

  // Create Fuse instance for resume skills
  const fuseOptions = {
    keys: [],
    threshold: 0.6, // 60% similarity threshold
    includeScore: true,
  };

  const fuse = new Fuse(resumeSkills, fuseOptions);

  const matchedSkills = [];
  const missingSkills = [];

  for (const requiredSkill of jdSkills) {
    const result = fuse.search(requiredSkill);

    if (result.length > 0 && result[0].score < 0.4) {
      // Lower score = better match in Fuse
      matchedSkills.push({
        jdSkill: requiredSkill,
        resumeSkill: result[0].item,
        score: Math.max(0, (1 - result[0].score) * 100), // Convert to 0-100
      });
    } else {
      missingSkills.push(requiredSkill);
    }
  }

  return {
    matchedSkills,
    missingSkills,
    matchedCount: matchedSkills.length,
    totalRequired: jdSkills.length,
  };
}

/**
 * String similarity matching using string-similarity library
 * Computes detailed similarity between resume text and JD keywords
 *
 * @param {Array} resumeSkills - Skills from resume
 * @param {Array} jdSkills - Required skills from JD
 * @returns {Object} Detailed similarity scores
 */
function stringSimilarityMatch(resumeSkills, jdSkills) {
  const resumeText = resumeSkills.join(" ").toLowerCase();
  const jdText = jdSkills.join(" ").toLowerCase();

  let totalScore = 0;
  const detailedMatches = [];

  for (const requiredSkill of jdSkills) {
    const bestMatch = Math.max(
      ...resumeSkills.map((skill) =>
        compareTwoStrings(requiredSkill.toLowerCase(), skill.toLowerCase())
      )
    );

    detailedMatches.push({
      skill: requiredSkill,
      similarity: bestMatch,
    });

    totalScore += bestMatch;
  }

  const averageScore =
    jdSkills.length > 0 ? (totalScore / jdSkills.length) * 100 : 0;

  return {
    averageScore: Math.min(100, averageScore),
    detailedMatches,
    textSimilarity:
      compareTwoStrings(resumeText, jdText) * 100,
  };
}

/**
 * Calculate overall keyword score
 * Combines fuzzy matching and string similarity
 *
 * @param {Object} fuzzyResults - Results from fuzzy matching
 * @param {Object} stringResults - Results from string similarity
 * @returns {number} Overall keyword score (0-100)
 */
function calculateKeywordScore(fuzzyResults, stringResults) {
  // Weight fuzzy matching higher (60%) than string similarity (40%)
  const fuzzyScore =
    fuzzyResults.totalRequired > 0
      ? (fuzzyResults.matchedCount / fuzzyResults.totalRequired) * 100
      : 0;

  const stringSimilarityScore = stringResults.averageScore;

  const keywordScore =
    fuzzyScore * 0.6 + stringSimilarityScore * 0.4;

  return Math.min(100, Math.max(0, keywordScore));
}

/**
 * Main function to match keywords and skills between resume and JD
 *
 * @param {Object} resumeParsed - Parsed resume data
 * @param {Object} jdParsed - Parsed job description data
 * @returns {Promise<Object>} Complete keyword matching results
 */
export const matchKeywords = async (resumeParsed, jdParsed) => {
  try {
    console.log("Starting keyword matching...");

    // Extract skills from parsed data
    const resumeSkills = extractSkills(resumeParsed.skills || []);
    const jdSkills = extractSkills(jdParsed.skills || []);

    // Extract additional keywords from raw text
    const resumeKeywords = extractKeywords(
      resumeParsed.rawText || ""
    );
    const jdKeywords = extractKeywords(jdParsed.rawText || "");

    // Combine skills and keywords for matching
    const allResumeKeywords = _.uniq([...resumeSkills, ...resumeKeywords]);
    const allJDKeywords = _.uniq([...jdSkills, ...jdKeywords]);

    // Perform fuzzy matching
    const fuzzyResults = fuzzyMatchSkills(allResumeKeywords, allJDKeywords);

    // Perform string similarity matching
    const stringResults = stringSimilarityMatch(allResumeKeywords, allJDKeywords);

    // Calculate overall keyword score
    const keywordScore = calculateKeywordScore(fuzzyResults, stringResults);

    console.log(`Keyword matching complete. Score: ${keywordScore.toFixed(2)}/100`);

    return {
      keywordScore,
      matchedSkills: fuzzyResults.matchedSkills.map((m) => m.jdSkill),
      missingSkills: fuzzyResults.missingSkills,
      matchedCount: fuzzyResults.matchedCount,
      totalRequired: fuzzyResults.totalRequired,
      matchPercentage: (
        (fuzzyResults.matchedCount / Math.max(1, fuzzyResults.totalRequired)) *
        100
      ).toFixed(2),
      detailedMatches: stringResults.detailedMatches,
      textSimilarity: stringResults.textSimilarity,
    };
  } catch (error) {
    console.error("Error matching keywords:", error);
    throw new Error(`Failed to match keywords: ${error.message}`);
  }
};

/**
 * Generate suggestions for missing skills
 *
 * @param {Array} missingSkills - Skills missing from resume
 * @param {string} resumeText - Full resume text
 * @returns {Array<Object>} Suggestions for improvement
 */
export const generateSuggestions = (missingSkills, resumeText) => {
  const suggestions = [];

  if (missingSkills.length === 0) {
    suggestions.push({
      type: "excellent",
      message: "All required skills are present in your resume!",
      priority: "low",
    });
    return suggestions;
  }

  const skillGroups = {
    technical: [],
    soft: [],
    tools: [],
    languages: [],
    other: [],
  };

  for (const skill of missingSkills) {
    const lowerSkill = skill.toLowerCase();

    if (
      ["python", "javascript", "java", "c++", "c#"].some((lang) =>
        lowerSkill.includes(lang)
      )
    ) {
      skillGroups.technical.push(skill);
    } else if (
      ["communication", "leadership", "teamwork", "presentation"].some((soft) =>
        lowerSkill.includes(soft)
      )
    ) {
      skillGroups.soft.push(skill);
    } else if (
      ["aws", "azure", "docker", "kubernetes", "git"].some((tool) =>
        lowerSkill.includes(tool)
      )
    ) {
      skillGroups.tools.push(skill);
    } else if (
      ["english", "spanish", "french", "mandarin"].some((lang) =>
        lowerSkill.includes(lang)
      )
    ) {
      skillGroups.languages.push(skill);
    } else {
      skillGroups.other.push(skill);
    }
  }

  // Generate targeted suggestions
  if (skillGroups.technical.length > 0) {
    suggestions.push({
      type: "technical",
      message: `Consider adding experience with: ${skillGroups.technical.join(", ")}`,
      skills: skillGroups.technical,
      priority: "high",
    });
  }

  if (skillGroups.tools.length > 0) {
    suggestions.push({
      type: "tools",
      message: `The role requires tools/platforms: ${skillGroups.tools.join(", ")}. Consider learning these.`,
      skills: skillGroups.tools,
      priority: "high",
    });
  }

  if (skillGroups.soft.length > 0) {
    suggestions.push({
      type: "soft_skills",
      message: `Soft skills highlighted: ${skillGroups.soft.join(", ")}. Emphasize these in your resume or cover letter.`,
      skills: skillGroups.soft,
      priority: "medium",
    });
  }

  if (skillGroups.languages.length > 0) {
    suggestions.push({
      type: "languages",
      message: `Language requirements: ${skillGroups.languages.join(", ")}`,
      skills: skillGroups.languages,
      priority: "medium",
    });
  }

  return suggestions;
};

export default {
  matchKeywords,
  generateSuggestions,
  extractKeywords,
  extractSkills,
};
