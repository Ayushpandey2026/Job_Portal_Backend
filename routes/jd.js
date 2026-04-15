import express from "express";
import { simplifyJD, checkAPIHealth } from "../controllers/jdController.js";

/**
 * Job Description Routes
 * Endpoints for job description processing and analysis
 * Uses Grok API (by xAI) for AI-powered simplification
 */

const router = express.Router();

/**
 * GET /api/jd/health
 * Diagnostic endpoint to check if Gemini API is configured
 */
router.get("/health", checkAPIHealth);

/**
 * POST /api/jd/simplify
 * Simplify job description using AI
 * Body:
 *   - jobDescription: String (required, 50-5000 characters)
 * 
 * Example:
 * POST /api/jd/simplify
 * {
 *   "jobDescription": "We are looking for a Senior Full Stack Developer with 5+ years of experience..."
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "simplifiedText": "...",
 *     "keyPoints": [...],
 *     "skills": [...],
 *     "experienceLevel": "..."
 *   }
 * }
 */
router.post("/simplify", simplifyJD);

export default router;
