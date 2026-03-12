import express from 'express';
import { getApplicantProfile, updateApplicantProfile, uploadResume } from '../controllers/applicantController.js';
import auth from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer config for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('application/pdf') || 
        file.mimetype.startsWith('application/msword') || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents allowed'));
    }
  }
});

// GET /api/applicant/profile
router.get('/profile', auth, getApplicantProfile);

// PUT /api/applicant/profile
router.put('/profile', auth, updateApplicantProfile);

// POST /api/applicant/resume-upload
router.post('/resume-upload', auth, upload.single('resume'), uploadResume);

export default router;
