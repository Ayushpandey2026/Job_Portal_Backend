import axios from "axios";
import pdf from 'pdf-parse-fork';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Affinda API Service for resume and job description parsing
 * Handles both API calls and fallback text extraction
 */

const AFFINDA_API_KEY = process.env.AFFINDA_API_KEY || "YOUR_AFFINDA_API_KEY";
const AFFINDA_BASE_URL = "https://api.affinda.com/v3";

/**
 * Parse resume using Affinda API with fallback to pdf-parse
 * @param {Buffer} fileBuffer - PDF/DOCX file buffer
 * @param {string} fileName - Name of the uploaded file
 * @returns {Promise<Object>} Parsed resume data
 */
export const parseResume = async (fileBuffer, fileName) => {
  try {
    console.log("Attempting to parse resume with Affinda API...");

    // Try using Affinda API if available (requires valid API key)
    if (AFFINDA_API_KEY !== "YOUR_AFFINDA_API_KEY") {
      try {
        const formData = new FormData();
        formData.append("file", fileBuffer, {
          filename: fileName,
          contentType: "application/pdf",
        });

        const response = await axios.post(
          `${AFFINDA_BASE_URL}/resumes`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${AFFINDA_API_KEY}`,
            },
            timeout: 30000,
          }
        );

        return parseAffindaResumeResponse(response.data);
      } catch (affindaError) {
        console.warn("Affinda API failed, using fallback PDF parser:", affindaError.message);
      }
    }

    // Fallback: Extract text from PDF using pdf-parse
    return await fallbackParseResume(fileBuffer);
  } catch (error) {
    console.error("Error in parseResume:", error);
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
};

/**
 * Parse job description using Affinda API with fallback
 * @param {string} jobDescription - Raw job description text
 * @returns {Promise<Object>} Parsed JD data
 */
export const parseJD = async (jobDescription) => {
  try {
    console.log("Attempting to parse JD with Affinda API...");

    // Try using Affinda API if available
    if (AFFINDA_API_KEY !== "YOUR_AFFINDA_API_KEY") {
      try {
        const response = await axios.post(
          `${AFFINDA_BASE_URL}/job_descriptions`,
          {
            file_url: null,
            raw_text: jobDescription,
          },
          {
            headers: {
              Authorization: `Bearer ${AFFINDA_API_KEY}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        return parseAffindaJDResponse(response.data);
      } catch (affindaError) {
        console.warn("Affinda API failed for JD, using fallback:", affindaError.message);
      }
    }

    // Fallback: Extract skills and keywords manually
    return fallbackParseJD(jobDescription);
  } catch (error) {
    console.error("Error in parseJD:", error);
    throw new Error(`Failed to parse job description: ${error.message}`);
  }
};

/**
 * Parse Affinda API response for resume
 * @private
 */
function parseAffindaResumeResponse(data) {
  try {
    const resume = data.data || data;

    return {
      skills: extractSkills(resume.skills || []),
      experience: extractExperience(resume.employment || []),
      education: extractEducation(resume.education || []),
      summary: resume.summary || "",
      rawText: resume.raw_text || "",
    };
  } catch (error) {
    console.error("Error parsing Affinda resume response:", error);
    return {
      skills: [],
      experience: [],
      education: [],
      summary: "",
      rawText: "",
    };
  }
}

/**
 * Parse Affinda API response for job description
 * @private
 */
function parseAffindaJDResponse(data) {
  try {
    const jd = data.data || data;

    return {
      skills: extractSkills(jd.skills || []),
      experience: extractExperience(jd.experience_requirements || []),
      education: extractEducation(jd.education_requirements || []),
      summary: jd.summary || "",
      rawText: jd.raw_text || "",
    };
  } catch (error) {
    console.error("Error parsing Affinda JD response:", error);
    return {
      skills: [],
      experience: [],
      education: [],
      summary: "",
      rawText: "",
    };
  }
}

/**
 * Fallback: Extract text from PDF file
 * @private
 */
async function fallbackParseResume(fileBuffer) {
  try {
    console.log("Using fallback PDF parser...");
    const pdfData = await pdf(fileBuffer);
    const rawText = pdfData.text;

    return {
      skills: extractSkillsFromText(rawText),
      experience: extractExperienceFromText(rawText),
      education: extractEducationFromText(rawText),
      summary: rawText.substring(0, 500),
      rawText: rawText,
    };
  } catch (error) {
    console.error("Error in fallbackParseResume:", error);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

/**
 * Fallback: Extract structured data from job description text
 * @private
 */
function fallbackParseJD(jobDescription) {
  return {
    skills: extractSkillsFromText(jobDescription),
    experience: extractExperienceFromText(jobDescription),
    education: extractEducationFromText(jobDescription),
    summary: jobDescription.substring(0, 500),
    rawText: jobDescription,
  };
}

/**
 * Extract skills from Affinda response
 * @private
 */
function extractSkills(skillsArray) {
  if (!Array.isArray(skillsArray)) return [];

  return skillsArray
    .map((skill) => {
      if (typeof skill === "string") return skill.toLowerCase();
      if (skill.name) return skill.name.toLowerCase();
      return null;
    })
    .filter(Boolean);
}

/**
 * Extract experience from Affinda response
 * @private
 */
function extractExperience(experienceArray) {
  if (!Array.isArray(experienceArray)) return [];

  return experienceArray
    .map((exp) => ({
      company: exp.company || exp.organization || "",
      position: exp.position || exp.title || "",
      duration: exp.duration || "",
      description: exp.description || "",
    }))
    .filter((exp) => exp.company || exp.position);
}

/**
 * Extract education from Affinda response
 * @private
 */
function extractEducation(educationArray) {
  if (!Array.isArray(educationArray)) return [];

  return educationArray
    .map((edu) => ({
      school: edu.school || edu.institution || "",
      degree: edu.degree || edu.field_of_study || "",
      graduation_date: edu.graduation_date || "",
    }))
    .filter((edu) => edu.school || edu.degree);
}

/**
 * Extract skills from raw text using keyword matching
 * @private
 */
function extractSkillsFromText(text) {
  const commonSkills = [
    "javascript",
    "python",
    "java",
    "c++",
    "c#",
    "react",
    "angular",
    "vue",
    "node.js",
    "express",
    "mongodb",
    "sql",
    "postgresql",
    "mysql",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "git",
    "linux",
    "html",
    "css",
    "typescript",
    "graphql",
    "rest api",
    "machine learning",
    "tensorflow",
    "pytorch",
    "nlp",
    "agile",
    "scrum",
  ];

  const lowerText = text.toLowerCase();
  const foundSkills = [];

  for (const skill of commonSkills) {
    if (lowerText.includes(skill) && !foundSkills.includes(skill)) {
      foundSkills.push(skill);
    }
  }

  return foundSkills;
}

/**
 * Extract experience keywords from text
 * @private
 */
function extractExperienceFromText(text) {
  const experienceKeywords = ["years", "experience", "worked", "managed"];
  const sentences = text.split(/[.!?]/);

  return sentences
    .filter((sentence) =>
      experienceKeywords.some((keyword) =>
        sentence.toLowerCase().includes(keyword)
      )
    )
    .slice(0, 3)
    .map((exp) => ({
      company: "",
      position: "",
      duration: "",
      description: exp.trim(),
    }));
}

/**
 * Extract education keywords from text
 * @private
 */
function extractEducationFromText(text) {
  const educationKeywords = [
    "bachelor",
    "master",
    "phd",
    "degree",
    "university",
    "college",
    "school",
  ];
  const sentences = text.split(/[.!?]/);

  return sentences
    .filter((sentence) =>
      educationKeywords.some((keyword) =>
        sentence.toLowerCase().includes(keyword)
      )
    )
    .slice(0, 2)
    .map((edu) => ({
      school: "",
      degree: edu.trim(),
      graduation_date: "",
    }));
}

export default {
  parseResume,
  parseJD,
};
