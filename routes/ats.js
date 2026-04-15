import express from "express";
import {
  matchResumeWithJD,
  checkDailyLimit,
  getATSResults,
  getATSResultDetail,
  deleteATSResult,
  getATSAnalytics,
  upload,
} from "../controllers/atsController.js";
import  auth  from "../middleware/auth.js";

/**
 * ATS Routes
 * Endpoints for resume and job description matching
 */

const router = express.Router();

/**
 * GET /api/ats/daily-check
 * Check if user can perform ATS check today (once per day limit)
 * Auth: Required
 */
router.get("/daily-check", auth, checkDailyLimit);

/**
 * POST /api/ats/match
 * Main ATS matching endpoint
 * Body:
 *   - resume: File (multipart)
 *   - jobDescription: String
 *   - saveResult: Boolean (optional)
 * Auth: Required
 */
router.post(
  "/match",
  auth,
  upload.single("resume"),
  matchResumeWithJD
);

/**
 * GET /api/ats/results
 * Get user's ATS results history
 * Query:
 *   - userId: String (optional, from auth middleware)
 *   - limit: Number (default: 10, max: 100)
 *   - skip: Number (default: 0)
 */
router.get("/results", getATSResults);

/**
 * GET /api/ats/results/:id
 * Get specific ATS result
 */
router.get("/results/:id", getATSResultDetail);

/**
 * DELETE /api/ats/results/:id
 * Delete an ATS result
 */
router.delete("/results/:id", deleteATSResult);

/**
 * GET /api/ats/analytics
 * Get ATS analytics for user
 * Query:
 *   - userId: String (optional)
 */
router.get("/analytics", getATSAnalytics);

export default router;
