
import express from 'express'
import Job from '../models/Job.js'
import Application from '../models/Application.js'
import auth from '../middleware/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import  * as  pdfParse  from 'pdf-parse'   // ✅ FIXED IMPORT

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// =======================
// MULTER STORAGE FIXED
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"))  // 🔥 GLOBAL root folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage })
const router = express.Router()

// =====================
// GET ALL JOBS
// =====================
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

// =====================
// GET JOB BY ID
// =====================
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('recruiter', 'name email')
    if (!job) return res.status(404).json({ message: 'Job not found' })
    res.json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// =====================
// UPDATE JOB
// =====================
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Access denied' })

    const job = await Job.findById(req.params.id)
    if (!job || job.recruiter.toString() !== req.user.id)
      return res.status(403).json({ message: 'Access denied' })

    Object.assign(job, req.body)
    await job.save()

    res.json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// =====================
// CREATE JOB
// =====================
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Access denied' })

    const job = new Job({ ...req.body, recruiter: req.user.id })
    await job.save()

    res.status(201).json(job)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})



// Get all applications for a specific job (Recruiter only)
router.get("/:jobId/applications", auth, async (req, res) => {
  try {
    if (req.user.role !== "recruiter") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { jobId } = req.params;

    const applications = await Application.find({ job: jobId })
      .populate("applicant", "name email phone")
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error("Error fetching job applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});




// =====================
// RECRUITER JOBS
// =====================
router.get('/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Access denied' })

    const jobs = await Job.find({ recruiter: req.user.id })
    res.json(jobs)
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// =====================
// APPLY JOB (APPLICANT)
// =====================
router.post('/:id/apply', auth, upload.single('resume'), async (req, res) => {
  try {
    if (req.user.role !== 'applicant') return res.status(403).json({ message: 'Access denied' })

    const job = await Job.findById(req.params.id)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // check duplicate
    const exists = await Application.findOne({ job: req.params.id, applicant: req.user.id })
    if (exists) return res.status(400).json({ message: 'Already applied' })

    // ========= Resume extraction =========
    let resumeText = ""
    let atsScore = 0
    let strongKeywords = []
    let missingKeywords = []

    if (req.file) {
      const filePath = path.join(process.cwd(), "uploads", req.file.filename)
      resumeText = await extractTextFromFile(filePath)

      const analysis = await analyzeResumeWithGemini(resumeText, job.description)
      atsScore = analysis.score
      strongKeywords = analysis.strongKeywords
      missingKeywords = analysis.missingKeywords
    }

    const application = new Application({
      job: req.params.id,
      applicant: req.user.id,
      resume: req.file ? `/uploads/${req.file.filename}` : null,
      atsScore,
      strongKeywords,
      missingKeywords
    })

    await application.save()

    res.status(201).json({
      message: "Application submitted",
      atsScore,
      strongKeywords,
      missingKeywords
    })

  } catch (error) {
    console.log("APPLY ERROR:", error)
    res.status(500).json({ message: 'Server error' })
  }
})

// =====================
// EXTRACT TEXT FROM FILE
// =====================
async function extractTextFromFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath)
      const data = await pdfParse(buffer)    // ✔ Correct function
      return data.text
    }

    if (ext === ".txt") return fs.readFileSync(filePath, "utf8")

    return "Unsupported file type"
  } catch (error) {
    console.error("PDF TEXT ERROR:", error)
    return "Error extracting text"
  }
}

// =====================
// ATS ANALYSIS WITH GEMINI
// =====================
async function analyzeResumeWithGemini(resumeText, jobDescription) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

    const prompt = `
      Compare this resume with the job description.
      Return JSON only: {"score": number, "strongKeywords": [], "missingKeywords": []}

      Resume: ${resumeText}
      Job Description: ${jobDescription}
    `

    const result = await model.generateContent(prompt)
    const txt = result.response.text()

    try {
      return JSON.parse(txt)
    } catch {
      return { score: 70, strongKeywords: [], missingKeywords: [] }
    }

  } catch (error) {
    console.error("Gemini Error:", error)
    return { score: 50, strongKeywords: [], missingKeywords: [] }
  }
}

export default router
