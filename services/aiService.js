import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

/**
 * AI Service for content generation and analysis
 * Configured for GROQ Cloud (gsk_ keys)
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
// Correct Endpoint for Groq (OpenAI Compatible)
const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  console.error("❌ ERROR: GROQ_API_KEY is not set in environment variables");
} else {
  console.log("✓ Groq API (gsk) Key detected successfully");
}

/**
 * Helper to call Groq API
 */
const callGroqAPI = async (prompt) => {
  if (!GROQ_API_KEY) throw new Error("Groq API Key is not configured");

  try {
    const response = await fetch(GROQ_API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Stable and fast model for Groq
        model: "llama-3.1-8b-instant", 
        messages: [
          {
            role: "system",
            content: "You are a professional HR assistant. You MUST respond ONLY with a valid JSON object. Do not include any conversational text or markdown blocks."
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        // Groq supports direct JSON mode
        response_format: { type: "json_object" } 
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API Error Details:", data);
      throw new Error(data.error?.message || `Groq Error: ${response.status}`);
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("Groq API call error:", error.message);
    throw error;
  }
};

/**
 * Safe JSON Parser helper
 */
const parseAIResponse = (text) => {
  try {
    // Sometimes AI still wraps in markdown, this cleans it
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse AI JSON:", text);
    throw new Error("Invalid response format from AI");
  }
};

/**
 * Simplify Job Description
 */
export const simplifyJobDescription = async (jobDescription) => {
  try {
    const prompt = `Analyze this job description and return a JSON object with these keys: 
    "simplifiedText" (2-3 sentences), 
    "keyResponsibilities" (array of strings), 
    "requiredSkills" (array of strings), 
    "experienceLevel" (string).

    JOB DESCRIPTION:
    ${jobDescription}`;

    const responseText = await callGroqAPI(prompt);
    const parsed = parseAIResponse(responseText);

    return {
      simplifiedText: parsed.simplifiedText || "Simplification unavailable.",
      keyPoints: parsed.keyResponsibilities || [],
      skills: parsed.requiredSkills || [],
      experienceLevel: parsed.experienceLevel || "Not specified",
    };
  } catch (error) {
    console.error("AI Service Error (simplifyJobDescription):", error.message);
    throw error;
  }
};

/**
 * Analyze Resume (Keeping the name same for frontend compatibility)
 */
export const analyzeResumeWithGemini = async (resumeText, jobDescription) => {
  try {
    const prompt = `Compare the resume with the JD. Return ONLY JSON:
    { "score": number, "strongKeywords": [], "missingKeywords": [] }

    RESUME: ${resumeText}
    JD: ${jobDescription}`;

    const responseText = await callGroqAPI(prompt);
    const parsed = parseAIResponse(responseText);

    return {
      score: parsed.score || 0,
      strongKeywords: parsed.strongKeywords || [],
      missingKeywords: parsed.missingKeywords || [],
    };
  } catch (error) {
    console.error("AI Service Error (analyzeResume):", error.message);
    return { score: 0, strongKeywords: [], missingKeywords: [] };
  }
};