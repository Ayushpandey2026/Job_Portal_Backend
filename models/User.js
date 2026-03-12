import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['recruiter', 'applicant', 'admin'],
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    default: ''
  },
  profile: {
    about: {
      type: String,
      default: ''
    },
    preferences: {
      jobType: { type: String, default: '' },
      location: { type: String, default: '' },
      salaryExpectation: { type: String, default: '' }
    },
    education: [{
      institution: String,
      degree: String,
      year: String
    }],
    keySkills: [String],
    languages: [{
      name: String,
      proficiency: String
    }],
    internships: [{
      company: String,
      role: String,
      duration: String
    }],
    projects: [{
      name: String,
      description: String,
      url: String
    }],
    profileSummary: {
      type: String,
      default: ''
    },
    resumeUrl: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true
})

export default mongoose.model('User', userSchema)
