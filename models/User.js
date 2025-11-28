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
    enum: ['recruiter', 'applicant','enum'],
    required: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  phone: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
})

export default mongoose.model('User', userSchema)
