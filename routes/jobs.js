import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';

import {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  getMyJobs,
  getApplicationsForJob,
  getAllApplicationsOfRecruiter,
  applyToJob,
} from '../controllers/jobController.js';

import path from 'path';
import fs from 'fs';

// =======================
// MULTER CONFIG
// =======================
const uploadPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `resume-${unique}${ext}`);
  }
});

const upload = multer({ storage });

const router = express.Router();

// ROUTES
router.get('/', getAllJobs);
router.get('/:id', getJobById);

router.post('/', auth, createJob);
router.put('/:id', auth, updateJob);
router.get('/my-jobs', auth, getMyJobs);
router.get('/:jobId/applications', auth, getApplicationsForJob);
router.get('/recruiter/all-applications', auth, getAllApplicationsOfRecruiter);
router.post('/:id/apply', auth, upload.single('resume'), applyToJob);

export default router;
