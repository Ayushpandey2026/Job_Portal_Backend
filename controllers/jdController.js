import { simplifyJobDescription } from "../services/aiService.js";

/**
 * Job Description Controller
 * Handles job description processing and simplification
 */

/**
 * GET /api/jd/health
 * Check if Grok API is properly configured
 */
export const checkAPIHealth = async (req, res) => {
  try {
    const apiKey = process.env.GROK_API_KEY;
    
    const status = {
      success: true,
      grokConfigured: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyPreview: apiKey ? apiKey.substring(0, 10) + "..." + apiKey.substring(apiKey.length - 5) : "NOT SET",
      environment: process.env.NODE_ENV || "development",
      apiProvider: "Grok (xAI)",
      endpoint: "https://api.x.ai/v1/chat/completions",
    };

    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking API health",
      error: error.message,
    });
  }
};

/**
 * POST /api/jd/simplify
 * Simplify a job description using AI (Grok API)
 * 
 * Request body:
 * {
 *   jobDescription: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     simplifiedText: string,
 *     keyPoints: string[],
 *     skills: string[],
 *     experienceLevel: string
 *   }
 * }
 */
export const simplifyJD = async (req, res) => {
  try {
    const { jobDescription } = req.body;

    // Validation
    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Job description is required",
      });
    }

    const trimmedJD = jobDescription.trim();

    if (trimmedJD.length < 50) {
      return res.status(400).json({
        success: false,
        message: "Job description must be at least 50 characters long",
      });
    }

    if (trimmedJD.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Job description must not exceed 5000 characters",
      });
    }

    console.log("Processing JD simplification with Grok API...");
    console.log("JD Length:", trimmedJD.length);
    
    const simplifiedData = await simplifyJobDescription(trimmedJD);

    return res.status(200).json({
      success: true,
      message: "Job description simplified successfully",
      data: {
        simplifiedText: simplifiedData.simplifiedText,
        keyPoints: simplifiedData.keyPoints,
        skills: simplifiedData.skills,
        experienceLevel: simplifiedData.experienceLevel,
      },
    });
  } catch (error) {
    console.error("Error in simplifyJD:", error.message);
    console.error("Full error:", error);
    
    // Check if it's an API key or configuration error
    if (error.message.includes("GROK_API_KEY") || error.message.includes("not configured")) {
      return res.status(500).json({
        success: false,
        message: "API configuration error: Grok API not configured",
        error: "Please ensure GROK_API_KEY is set in environment variables",
      });
    }

    // Check if it's a Grok API error
    if (error.message.includes("Grok API Error")) {
      return res.status(500).json({
        success: false,
        message: "Grok API Error: Failed to process request",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to simplify job description",
      error: error.message,
    });
  }
};
