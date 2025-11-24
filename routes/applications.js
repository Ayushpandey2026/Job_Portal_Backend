import express from 'express'
import Application from '../models/Application.js'
import auth from '../middleware/auth.js'

const router = express.Router()

// Get applicant's applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'applicant') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const applications = await Application.find({ applicant: req.user.id })
      .populate('job', 'title company location')
      .sort({ appliedAt: -1 })

    res.json(applications)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})


// Get all applications (Recruiter only)
router.get('/all-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const apps = await Application.find()
      .populate('applicant', 'name email resume')
      .populate('job', 'title company location')
      .sort({ appliedAt: -1 })

    res.json(apps)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})


export default router
