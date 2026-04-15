import { pipeline } from "@xenova/transformers";

/**
 * Embedding Service using all-MiniLM-L6-v2 model via transformers.js
 * Provides semantic similarity computation between resume and job description
 */

let embeddingPipeline = null;

/**
 * Initialize the embedding model (lazy loading)
 * Uses all-MiniLM-L6-v2 model for efficient semantic embeddings
 */
async function initializeModel() {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  try {
    console.log("Initializing embedding model (all-MiniLM-L6-v2)...");
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("Embedding model initialized successfully");
    return embeddingPipeline;
  } catch (error) {
    console.error("Error initializing embedding model:", error);
    throw new Error(`Failed to initialize embedding model: ${error.message}`);
  }
}

/**
 * Get embedding vector for a text
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} Embedding vector
 */
async function getEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    const extractor = await initializeModel();

    // Generate embedding
    const result = await extractor(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert to array and transpose
    const embedding = Array.from(result.data);
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Compute cosine similarity between two vectors
 * Formula: (A · B) / (||A|| * ||B||)
 * Returns value between -1 and 1, where 1 is identical
 *
 * @param {Array} vectorA - First vector
 * @param {Array} vectorB - Second vector
 * @returns {number} Cosine similarity score (-1 to 1)
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length === 0 || vectorB.length === 0) {
    throw new Error("Vectors cannot be empty");
  }

  if (vectorA.length !== vectorB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Compute semantic similarity score between resume and job description
 * Returns normalized score (0-100)
 *
 * @param {string} resumeText - Processed resume text
 * @param {string} jobDescriptionText - Job description text
 * @returns {Promise<Object>} Similarity scores and embeddings
 */
export const computeSemanticSimilarity = async (
  resumeText,
  jobDescriptionText
) => {
  try {
    if (!resumeText || !jobDescriptionText) {
      throw new Error("Resume and job description texts are required");
    }

    console.log("Computing semantic similarity...");

    // Preprocess texts: truncate to reasonable length while keeping important content
    // Take up to 2000 characters for better semantic representation
    const processedResumeText = resumeText.substring(0, 2000).trim();
    const processedJDText = jobDescriptionText.substring(0, 2000).trim();

    console.log(`Processing resume text (${processedResumeText.length} chars) and JD (${processedJDText.length} chars)`);

    // Generate embeddings for both texts
    const resumeEmbedding = await getEmbedding(processedResumeText);
    const jdEmbedding = await getEmbedding(processedJDText);

    // Compute cosine similarity
    const similarityScore = cosineSimilarity(resumeEmbedding, jdEmbedding);

    // Normalize to 0-100 scale
    // Cosine similarity ranges from -1 to 1, we map 0-1 to 0-100
    const normalizedScore = Math.max(0, Math.min(100, (similarityScore + 1) * 50));

    console.log(`Raw similarity: ${similarityScore.toFixed(4)}, Normalized: ${normalizedScore.toFixed(2)}/100`);

    return {
      semanticScore: normalizedScore,
      rawSimilarity: similarityScore,
      resumeEmbeddingLength: resumeEmbedding.length,
      jdEmbeddingLength: jdEmbedding.length,
    };
  } catch (error) {
    console.error("Error computing semantic similarity:", error);
    throw new Error(
      `Failed to compute semantic similarity: ${error.message}`
    );
  }
};

/**
 * Compute similarity between two individual texts for comparison
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {Promise<number>} Similarity score (0-100)
 */
export const compareSimilarity = async (text1, text2) => {
  try {
    const embedding1 = await getEmbedding(text1);
    const embedding2 = await getEmbedding(text2);
    const score = cosineSimilarity(embedding1, embedding2);
    return Math.max(0, Math.min(100, (score + 1) * 50));
  } catch (error) {
    console.error("Error comparing similarity:", error);
    return 0;
  }
};

export default {
  computeSemanticSimilarity,
  compareSimilarity,
  getEmbedding,
};
