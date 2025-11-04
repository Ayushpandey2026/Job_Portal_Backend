import mongoose from 'mongoose'

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Software Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'Data Scientist', 'DevOps Engineer', 'UI/UX Designer', 'Product Manager', 'Other'],
    required: true
  },
  openings: {
    type: Number,
    required: true,
    min: 1
  },
  deadline: {
    type: Date,
    required: true
  },
  constraints: {
    type: String
  },
  salary: {
    type: String
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
})

export default mongoose.model('Job', jobSchema)
