import multer from "multer";
import path from "path";
import fs from "fs";
import { parseResume, parseJD } from "../services/affindaService.js";
import { performATSMatching } from "../services/atsService.js";
import { ATSResult, ParsedResume } from "../models/ATSResult.js";

/**
 * ATS Controller
 * Handles file uploads, orchestrates matching services, and returns results
 * Enforces once-per-day limit on ATS checks
 */

// Configure multer for file uploads
const uploadDir = "uploads/resumes";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize filename
    const name = file.originalname
      .replace(/[^a-zA-Z0-9-_.]/g, "_")
      .split(".");
    const ext = name.pop();
    cb(null, `${name.join(".")}-${uniqueSuffix}.${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow only PDF and DOCX files
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type: ${file.mimetype}. Only PDF and DOCX allowed.`)
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * GET /api/ats/daily-check
 * Check if user can perform ATS check today
 */
export const checkDailyLimit = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not found",
      });
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count ATS results created today
    const todayChecks = await ATSResult.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    // User gets 1 check per day
    const canCheckToday = todayChecks < 1;
    const checksRemaining = Math.max(0, 1 - todayChecks);

    // Calculate next check time (tomorrow at midnight)
    let nextCheckTime = null;
    if (!canCheckToday) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextCheckTime = tomorrow;
    }

    return res.status(200).json({
      success: true,
      canCheckToday,
      checksRemaining,
      nextCheckTime,
      checksUsedToday: todayChecks,
    });
  } catch (error) {
    console.error("Error checking daily limit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check daily limit",
      error: error.message,
    });
  }
};

/**
 * POST /api/ats/match
 * Main endpoint for ATS matching
 *
 * Request:
 * - resume: PDF/DOCX file
 * - jobDescription: Text describing the job
 * - saveResult: Boolean (optional, default: true)
 */
export const matchResumeWithJD = async (req, res) => {
  let uploadedFilePath = null;

  try {
    const userId = req.user?.id;

    // Check daily limit first
    if (userId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayChecks = await ATSResult.countDocuments({
        userId,
        createdAt: { $gte: today },
      });

      if (todayChecks >= 1) {
        // Delete uploaded file before returning error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error deleting uploaded file:", err);
          });
        }

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return res.status(429).json({
          success: false,
          message: "You have reached your daily limit for ATS checks. Try again tomorrow.",
          canCheckToday: false,
          checksRemaining: 0,
          nextCheckTime: tomorrow,
        });
      }
    }

    // Validate input
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    if (!req.body.jobDescription) {
      return res.status(400).json({
        success: false,
        message: "Job description is required",
      });
    }

    const jobDescription = req.body.jobDescription.trim();

    if (jobDescription.length < 50) {
      return res.status(400).json({
        success: false,
        message: "Job description must be at least 50 characters",
      });
    }

    uploadedFilePath = req.file.path;
    const fileBuffer = fs.readFileSync(uploadedFilePath);
    const fileName = req.file.originalname;

    console.log(`Processing resume: ${fileName}`);
    console.log(`Job description length: ${jobDescription.length} characters`);

    // Step 1: Parse resume
    console.log("Step 1: Parsing resume...");
    const resumeParsed = await parseResume(fileBuffer, fileName);

    // Step 2: Parse job description
    console.log("Step 2: Parsing job description...");
    const jdParsed = await parseJD(jobDescription);

    // Step 3: Perform ATS matching
    console.log("Step 3: Performing ATS matching...");
    const atsResult = await performATSMatching(resumeParsed, jdParsed);

    // Step 4: Save result to database (optional)
    let savedResult = null;
    const shouldSave = req.body.saveResult !== "false";

    if (shouldSave) {
      try {
        savedResult = await saveATSResult(
          userId || "anonymous",
          resumeParsed.rawText,
          jobDescription,
          atsResult,
          fileName
        );

        console.log(`ATS result saved with ID: ${savedResult._id}`);
      } catch (saveError) {
        console.error("Error saving ATS result:", saveError);
        // Continue without saving - this isn't critical
      }
    }

    // Clean up uploaded file after processing
    fs.unlink(uploadedFilePath, (err) => {
      if (err) console.error("Error deleting uploaded file:", err);
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "ATS matching completed successfully",
      data: {
        ...atsResult,
        _id: savedResult?._id,
      },
    });
  } catch (error) {
    console.error("Error in matchResumeWithJD:", error);

    // Clean up uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlink(uploadedFilePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }

    return res.status(500).json({
      success: false,
      message: `ATS matching failed: ${error.message}`,
      error: error.message,
    });
  }
};

/**
 * Save ATS result to database
 * @private
 */
async function saveATSResult(
  userId,
  resumeText,
  jobDescription,
  atsResult,
  fileName
) {
  const result = new ATSResult({
    userId,
    resumeText,
    resumeFileName: fileName,
    jobDescription,
    finalScore: atsResult.finalScore,
    semanticScore: atsResult.semanticScore,
    keywordScore: atsResult.keywordScore,
    grade: atsResult.grade,
    level: atsResult.level,
    matchedSkills: atsResult.matchedSkills,
    missingSkills: atsResult.missingSkills,
    matchedCount: atsResult.matchedCount,
    totalRequired: atsResult.totalRequired,
    matchPercentage: atsResult.matchPercentage,
    suggestions: atsResult.suggestions,
    readiness: atsResult.readiness,
    readinessScore: atsResult.readinessScore,
    insights: atsResult.insights,
  });

  return await result.save();
}

/**
 * GET /api/ats/results
 * Get all ATS results for current user
 */
export const getATSResults = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = parseInt(req.query.skip) || 0;

    const results = await ATSResult.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .select(
        "finalScore grade level matchPercentage readiness createdAt jobDescription resumeFileName"
      );

    const total = await ATSResult.countDocuments({ userId });

    return res.status(200).json({
      success: true,
      data: results,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error("Error in getATSResults:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ATS results",
      error: error.message,
    });
  }
};

/**
 * GET /api/ats/results/:id
 * Get specific ATS result details
 */
export const getATSResultDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ATSResult.findById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "ATS result not found",
      });
    }

    // Check authorization
    if (req.user && req.user.id !== result.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this result",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getATSResultDetail:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ATS result",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/ats/results/:id
 * Delete an ATS result
 */
export const deleteATSResult = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await ATSResult.findById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "ATS result not found",
      });
    }

    // Check authorization
    if (userId && userId !== result.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this result",
      });
    }

    await ATSResult.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "ATS result deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteATSResult:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete ATS result",
      error: error.message,
    });
  }
};

/**
 * GET /api/ats/analytics
 * Get ATS analytics for user
 */
export const getATSAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const results = await ATSResult.find({ userId });

    if (results.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalMatches: 0,
          averageScore: 0,
          gradeDistribution: {},
          skillGaps: [],
        },
      });
    }

    // Calculate analytics
    const totalMatches = results.length;
    const averageScore =
      results.reduce((sum, r) => sum + r.finalScore, 0) / results.length;
    const averageKeywordMatch =
      results.reduce((sum, r) => sum + (parseFloat(r.matchPercentage) || 0), 0) /
      results.length;

    // Grade distribution
    const gradeDistribution = {};
    results.forEach((r) => {
      gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    });

    // Most common missing skills
    const skillGaps = {};
    results.forEach((r) => {
      r.missingSkills.forEach((skill) => {
        skillGaps[skill] = (skillGaps[skill] || 0) + 1;
      });
    });

    const topSkillGaps = Object.entries(skillGaps)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, count]) => ({ skill, count }));

    return res.status(200).json({
      success: true,
      data: {
        totalMatches,
        averageScore: Math.round(averageScore * 100) / 100,
        averageKeywordMatch: Math.round(averageKeywordMatch * 100) / 100,
        gradeDistribution,
        topSkillGaps,
        dateRange: {
          from: results[results.length - 1].createdAt,
          to: results[0].createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Error in getATSAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics",
      error: error.message,
    });
  }
};

export default {
  matchResumeWithJD,
  getATSResults,
  getATSResultDetail,
  deleteATSResult,
  getATSAnalytics,
  upload,
};
