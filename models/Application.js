import mongoose from 'mongoose'

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  resume: {
    type: String, // File path or URL
    required: true
  },
  atsScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  strongKeywords: [{
    type: String
  }],
  missingKeywords: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'selected', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

export default mongoose.model('Application', applicationSchema)
