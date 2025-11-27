import express from 'express';
import auth from '../middleware/auth.js';
import { getApplicationsForJob } from "../controllers/applicationController.js";
import { protectRecruiter } from "../middleware/auth.js";


import {
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
} from '../controllers/applicationController.js';

const router = express.Router();

// Applicant - My Applications
router.get('/my-applications', auth, getMyApplications);
router.get("/job/:jobId", protectRecruiter, getApplicationsForJob);



router.get(
  "/job/:jobId",
  protectRecruiter,
  getApplicationsForJob
);


// Recruiter - Applications for a specific job
router.get('/job/:jobId', auth, getJobApplications);

// Recruiter - Update status
router.patch('/:appId/status', auth, updateApplicationStatus);

export default router;
