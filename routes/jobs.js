
import express from 'express'
import { extractTextFromFile } from "../utils/pdfparser.js";
import Job from '../models/Job.js'
import Application from '../models/Application.js'
import auth from '../middleware/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
// import  * as  pdfParse  from 'pdf-parse'   // ✅ FIXED IMPORT
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { analyzeResumeWithGemini } from '../utils/gemini.js'


// 1️⃣ Define upload path
const uploadPath = path.join(process.cwd(), 'uploads');

// 2️⃣ Ensure folder exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// =======================
// MULTER STORAGE FIXED
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = file.fieldname.replace(/\s+/g, "_");
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

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
// router.get('/my-jobs', auth, async (req, res) => {
//   try {
//     if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Access denied' })

//     const jobs = await Job.find({ recruiter: req.user.id })
//     res.json(jobs)
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' })
//   }
// })

// GET /api/jobs/my-jobs
router.get('/my-jobs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' })
    }

    const jobs = await Job.find({ recruiter: req.user._id })
      .sort({ createdAt: -1 })

    res.json(jobs)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})






// =====================
// APPLY JOB (APPLICANT)
// =====================
router.post('/:id/apply', auth, upload.single('resume'), async (req, res) => {
  try {
    console.log("🔥 APPLY ROUTE HIT");

    if (req.user.role !== 'applicant') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Duplicate check
    const exists = await Application.findOne({
      job: req.params.id,
      applicant: req.user.id,
    });

    if (exists) {
      return res.status(400).json({ message: 'Already applied' });
    }

    // ===== RESUME TEXT + ATS SCORE =====
    let resumeText = "";
    let atsScore = 0;
    let strongKeywords = [];
    let missingKeywords = [];

    if (req.file) {
      const filePath = path.join(process.cwd(), "uploads", req.file.filename);

      // Extract PDF text
      resumeText = await extractTextFromFile(req);

      // Run ATS comparison
      const analysis = await analyzeResumeWithGemini(resumeText, job.description);

      atsScore = analysis.score;
      strongKeywords = analysis.strongKeywords;
      missingKeywords = analysis.missingKeywords;
    }

    // SAVE APPLICATION
    const application = new Application({
      job: req.params.id,
      applicant: req.user.id,
      resume: req.file ? `/uploads/${req.file.filename}` : null,
      atsScore,
      strongKeywords,
      missingKeywords,
    });

    await application.save();

    console.log("✅ APPLICATION SAVED:", application);

    return res.status(201).json({
      message: "Application submitted",
      atsScore,
      strongKeywords,
      missingKeywords,
    });

  } catch (error) {
    console.log("❌ APPLY ERROR:", error);
    res.status(500).json({ message: "Server error", error });
  }
});



export default router
