import mongoose from 'mongoose'

const resumeCheckSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resume: {
    type: String, // File path
    required: true
  },
  atsScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  strongKeywords: [{
    type: String
  }],
  missingKeywords: [{
    type: String
  }],
  suggestions: [{
    type: String
  }],
  checkedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Index for efficient queries
resumeCheckSchema.index({ user: 1, checkedAt: -1 })

export default mongoose.model('ResumeCheck', resumeCheckSchema)
