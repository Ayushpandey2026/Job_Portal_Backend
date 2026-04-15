import mongoose from "mongoose";

/**
 * ATS Results Schema
 * Stores resume matching results for historical analysis and tracking
 */

const atsResultSchema = new mongoose.Schema(
  {
    // User Reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Resume Information
    resumeText: {
      type: String,
      required: true,
    },
    resumeFileName: {
      type: String,
      default: "resume.pdf",
    },

    // Job Description Information
    jobDescription: {
      type: String,
      required: true,
    },

    // Score Breakdown
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    semanticScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    keywordScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Grade Information
    grade: {
      type: String,
      enum: ["A+", "A", "B", "C", "D", "F"],
    },
    level: {
      type: String,
    },

    // Skill Analysis
    matchedSkills: [
      {
        type: String,
      },
    ],
    missingSkills: [
      {
        type: String,
      },
    ],
    matchedCount: {
      type: Number,
      default: 0,
    },
    totalRequired: {
      type: Number,
      default: 0,
    },
    matchPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Suggestions
    suggestions: [
      {
        type: {
          type: String,
        },
        message: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high"],
        },
        skills: [String],
      },
    ],

    // Readiness Assessment
    readiness: {
      type: String,
      enum: ["Ready to Apply", "Consider Improvement"],
    },
    readinessScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Insights
    insights: [
      {
        type: {
          type: String,
        },
        area: String,
        message: String,
      },
    ],

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
atsResultSchema.index({ userId: 1, createdAt: -1 });
atsResultSchema.index({ finalScore: -1 });
atsResultSchema.index({ grade: 1 });

/**
 * Schema for storing parsed resume data
 * Used for caching and historical analysis
 */
const parsedResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resumeText: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
    },
    skills: [String],
    experience: [
      {
        company: String,
        position: String,
        duration: String,
        description: String,
      },
    ],
    education: [
      {
        school: String,
        degree: String,
        graduation_date: String,
      },
    ],
    summary: String,
    parsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

parsedResumeSchema.index({ userId: 1, parsedAt: -1 });

export const ATSResult = mongoose.model("ATSResult", atsResultSchema);
export const ParsedResume = mongoose.model("ParsedResume", parsedResumeSchema);

export default {
  ATSResult,
  ParsedResume,
};
