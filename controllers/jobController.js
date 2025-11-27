import Job from '../models/Job.js';
import Application from '../models/Application.js';
import { extractTextFromFile } from '../utils/pdfparser.js';
import { analyzeResumeWithGemini } from '../utils/gemini.js';
import path from 'path';

// =====================
// GET ALL JOBS
// =====================
export const getAllJobs = async (req, res) => {
  try {
    const { title, location, category, type } = req.query;
    let query = {};

    if (title) query.title = { $regex: title, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (category) query.category = category;
    if (type) query.constraints = { $regex: type, $options: 'i' };

    const jobs = await Job.find(query).populate('recruiter', 'name email');
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// GET JOB BY ID
// =====================
export const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('recruiter', 'name email');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// CREATE JOB
// =====================
export const createJob = async (req, res) => {
  try {
    if (req.user.role !== 'recruiter')
      return res.status(403).json({ message: 'Access denied' });

    const job = new Job({ ...req.body, recruiter: req.user.id });
    await job.save();

    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// UPDATE JOB
// =====================
export const updateJob = async (req, res) => {
  try {
    if (req.user.role !== 'recruiter')
      return res.status(403).json({ message: 'Access denied' });

    const job = await Job.findById(req.params.id);
    if (!job || job.recruiter.toString() !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    Object.assign(job, req.body);
    await job.save();

    res.json(job);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// RECRUITER — MY JOBS
// =====================
export const getMyJobs = async (req, res) => {
  try {
    if (req.user.role !== 'recruiter')
      return res.status(403).json({ message: 'Access denied' });

    const jobs = await Job.find({ recruiter: req.user._id })
      .sort({ createdAt: -1 });

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// GET APPLICATIONS FOR A JOB
// =====================
export const getApplicationsForJob = async (req, res) => {
  try {
    if (req.user.role !== 'recruiter')
      return res.status(403).json({ message: 'Access denied' });

    const applications = await Application.find({ job: req.params.jobId })
      .populate("applicant", "name email phone")
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// =====================
// APPLY TO JOB
// =====================
export const applyToJob = async (req, res) => {
  try {
    if (req.user.role !== 'applicant') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Check duplicate application
    const exists = await Application.findOne({
      job: req.params.id,
      applicant: req.user.id,
    });

    if (exists) {
      return res.status(400).json({ message: 'Already applied' });
    }

    // Extract resume text + ATS score
    let resumeText = "";
    let atsScore = 0;
    let strongKeywords = [];
    let missingKeywords = [];

    if (req.file) {
      resumeText = await extractTextFromFile(req);

      const analysis = await analyzeResumeWithGemini(
        resumeText,
        job.description
      );

      atsScore = analysis.score;
      strongKeywords = analysis.strongKeywords;
      missingKeywords = analysis.missingKeywords;
    }

    const application = new Application({
      job: req.params.id,
      applicant: req.user.id,
      resume: req.file ? `/uploads/${req.file.filename}` : null,
      atsScore,
      strongKeywords,
      missingKeywords,
    });

    await application.save();

    return res.status(201).json({
      message: "Application submitted",
      atsScore,
      strongKeywords,
      missingKeywords,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


export const getAllApplicationsOfRecruiter = async (req, res) => {
  try {
    const jobs = await Job.find({ recruiter: req.user._id }).select('_id');
    const jobIds = jobs.map(j => j._id);

    const apps = await Application.find({ job: { $in: jobIds } })
      .populate("applicant", "name email")
      .populate("job", "title company");

    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
