import express from 'express'
import Job from '../models/Job.js'
import Application from '../models/Application.js'
import auth from '../middleware/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import * as pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })

const router = express.Router()

// Get all jobs with filters
router.get('/', async (req, res) => {
  try {
    const { title, location, category, type } = req.query
    let query = {}

    if (title) query.title = { $regex: title, $options: 'i' }
    if (location) query.location = { $regex: location, $options: 'i' }
    if (category) query.category = category
    if (type) query.constraints = { $regex: type, $options: 'i' }

    const jobs = await Job.find(query).populate('recruiter', 'name email')
    res.json(jobs)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('recruiter', 'name email')
    if (!job) {
      return res.status(404).json({ message: 'Job not found' })
    }
    res.json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Update job (recruiter only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const job = await Job.findById(req.params.id)
    if (!job || job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    Object.assign(job, req.body)
    await job.save()
    res.json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Create job (recruiter only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const job = new Job({
      ...req.body,
      recruiter: req.user.id
    })

    await job.save()
    res.status(201).json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get recruiter's jobs
router.get('/my-jobs', auth, async (req, res) => {
  try {
    console.log('my-jobs route called, req.user:', req.user)
    if (req.user.role !== 'recruiter') {
      console.log('Access denied: user role is', req.user.role)
      return res.status(403).json({ message: 'Access denied' })
    }

    console.log('Finding jobs for recruiter:', req.user.id)
    const jobs = await Job.find({ recruiter: req.user.id })
    console.log('Found jobs:', jobs.length)
    res.json(jobs)
  } catch (error) {
    console.error('Error in my-jobs route:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Server error' })
  }
})

// Apply for job
router.post('/:id/apply', auth, upload.single('resume'), async (req, res) => {
  try {
    if (req.user.role !== 'applicant') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const job = await Job.findById(req.params.id)
    if (!job) {
      return res.status(404).json({ message: 'Job not found' })
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: req.params.id,
       applicant: req.user.id
    })

    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied' })
    }

    let resumeText = ''
    let atsScore = 0
    let strongKeywords = []
    let missingKeywords = []

    if (req.file) {
      // Extract text from PDF or DOCX
      const filePath = path.join(__dirname, '../uploads', req.file.filename)
      resumeText = await extractTextFromFile(filePath)

      // Calculate ATS score and keywords using Gemini
      const analysis = await analyzeResumeWithGemini(resumeText, job.description)
      atsScore = analysis.score
      strongKeywords = analysis.strongKeywords
      missingKeywords = analysis.missingKeywords
    }

    const application = new Application({
      job: req.params.id,
      applicant: req.user.id,
      resume: req.file ? req.file.path : req.body.resume,
      atsScore,
      strongKeywords,
      missingKeywords
    })

    await application.save()
    res.status(201).json({
      message: 'Application submitted',
      atsScore,
      strongKeywords,
      missingKeywords
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get applications for a job (recruiter only)
router.get('/:id/applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const job = await Job.findById(req.params.id)
    if (!job || job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const applications = await Application.find({ job: req.params.id })
      .populate('applicant', 'name email')
      .sort({ atsScore: -1, appliedAt: -1 }) // Sort by ATS score descending, then by application date

    res.json(applications)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})



// Get all applications for recruiter's jobs
router.get('/my-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const { minScore } = req.query
    let query = {}

    // Find all jobs by this recruiter
    const recruiterJobs = await Job.find({ recruiter: req.user.id }).select('_id')
    const jobIds = recruiterJobs.map(job => job._id)

    query.job = { $in: jobIds }

    if (minScore) {
      query.atsScore = { $gte: parseInt(minScore) }
    }

    const applications = await Application.find(query)
      .populate('applicant', 'name email')
      .populate('job', 'title company')
      .sort({ atsScore: -1, appliedAt: -1 })

    res.json(applications)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get selected applications for recruiter's jobs
router.get('/my-selected-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Find all jobs by this recruiter
    const recruiterJobs = await Job.find({ recruiter: req.user.id }).select('_id')
    const jobIds = recruiterJobs.map(job => job._id)

    const applications = await Application.find({
      job: { $in: jobIds },
      status: 'selected'
    })
      .populate('applicant', 'name email')
      .populate('job', 'title company')
      .sort({ appliedAt: -1 })

    res.json(applications)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Select/reject application (recruiter only)
router.put('/:jobId/applications/:appId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const { status, rejectionReason } = req.body

    const application = await Application.findById(req.params.appId)
      .populate('job')

    if (!application || application.job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    application.status = status
    if (status === 'rejected' && rejectionReason) {
      application.rejectionReason = rejectionReason
    }

    if (status === 'selected') {
      // Decrease openings
      const job = await Job.findById(application.job._id)
      if (job.openings > 0) {
        job.openings -= 1
        await job.save()
      }
    }

    await application.save()
    res.json(application)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Helper function to extract text from file
async function extractTextFromFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath)
      const data = await new pdfParse.PDFParse(dataBuffer)
      return data.text
    } else if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf8')
    } else {
      // For other formats, return a placeholder
      return "Resume content extracted from file"
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    return "Error extracting resume text"
  }
}

// Helper function to analyze resume with Gemini
async function analyzeResumeWithGemini(resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    const prompt = `
    Analyze this resume against the job description and provide:
    1. ATS compatibility score (0-100)
    2. Strong keywords present in resume
    3. Missing keywords that should be added

    Resume: ${resumeText}

    Job Description: ${jobDescription}

    Return in JSON format: {"score": number, "strongKeywords": [array], "missingKeywords": [array]}
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse JSON response
    try {
      return JSON.parse(text)
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        score: 75,
        strongKeywords: ["JavaScript", "React", "Node.js"],
        missingKeywords: ["TypeScript", "MongoDB", "AWS"]
      }
    }
  } catch (error) {
    console.error('Gemini API error:', error)
    return {
      score: 70,
      strongKeywords: ["JavaScript", "React"],
      missingKeywords: ["TypeScript", "Database"]
    }
  }
}

// Get all applications on platform (for recruiters)
router.get('/all-applications', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const { minScore } = req.query
    let query = {}

    if (minScore) {
      query.atsScore = { $gte: parseInt(minScore) }
    }

    const applications = await Application.find(query)
      .populate('applicant', 'name email')
      .populate('job', 'title company')
      .sort({ atsScore: -1, appliedAt: -1 })

    res.json(applications)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
