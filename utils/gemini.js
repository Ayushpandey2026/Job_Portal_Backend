import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const analyzeResumeWithGemini = async (resumeText, jobDescription) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      Compare this resume with job description.
      Give output as JSON:
      {
        "score": number,
        "strongKeywords": string[],
        "missingKeywords": string[]
      }

      RESUME:
      ${resumeText}

      JOB DESCRIPTION:
      ${jobDescription}
    `;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    return JSON.parse(text);  
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      score: 0,
      strongKeywords: [],
      missingKeywords: []
    };
  }
};
