import express from 'express'
import Application from '../models/Application.js'
import Job from '../models/Job.js'  // Added import of Job model
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

// routes/applications.js  (or where this route lives) - REPLACE the existing PUT handler
router.put('/:jobId/applications/:appId', auth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const { jobId: jobIdParam, appId } = req.params;

    // 1) Load application and populate job & recruiter
    const application = await Application.findById(appId).populate({
      path: 'job',
      select: 'openings recruiter title company'
    });

    if (!application) {
      console.warn('Application not found:', appId);
      return res.status(404).json({ message: 'Application not found' });
    }

    // 2) Determine jobId: prefer populated job from application (safer)
    const jobId = application.job ? application.job._id.toString() : jobIdParam;
    if (!jobId) {
      console.error('No jobId available for application:', appId);
      return res.status(400).json({ message: 'Job id unavailable for this application' });
    }

    // 3) Authorize: only recruiter who owns the job can change status
    const jobOwnerId = application.job?.recruiter?.toString();
    if (!jobOwnerId) {
      console.error('Job has no recruiter info populated for job:', jobId);
      return res.status(500).json({ message: 'Job recruiter information missing' });
    }
    if (jobOwnerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 4) Handle status changes
    if (status === 'selected') {
      // ensure openings exist
      const job = await Job.findById(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });

      if (job.openings <= 0) {
        return res.status(400).json({ message: 'No openings left' });
      }

      // Update job openings and application status
      job.openings = job.openings - 1;
      application.status = 'selected';
      application.rejectionReason = '';

      await job.save();
      await application.save();

      return res.json({ message: 'Applicant selected successfully', application });
    }

    if (status === 'rejected') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({ message: 'Rejection reason required' });
      }

      application.status = 'rejected';
      application.rejectionReason = rejectionReason.trim();
      await application.save();

      return res.json({ message: 'Applicant rejected successfully', application });
    }

    // invalid status
    return res.status(400).json({ message: 'Invalid status' });
  } catch (error) {
    console.error('STATUS UPDATE ERROR:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



// GET /api/applications/my-applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    const myApplications = await Application.find({ applicant: req.user._id })
      .populate('job')
      .populate('applicant'); // optional

    res.json(myApplications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// GET /api/applications/job/:jobId
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Access denied' })

    const job = await Job.findById(req.params.jobId)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    if (job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const applications = await Application.find({ job: job._id })
      .populate('applicant', 'name email resume')
      .sort({ appliedAt: -1 })

    res.json(applications)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})




// PATCH /api/applications/:appId/status
router.patch('/:appId/status', auth, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body
    const app = await Application.findById(req.params.appId).populate('job')
    if (!app) return res.status(404).json({ message: 'Application not found' })

    if (app.job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (status === 'selected') {
      if (app.job.openings <= 0) return res.status(400).json({ message: 'No openings left' })
      app.status = 'selected'
      app.rejectionReason = ''
      app.job.openings -= 1
      await app.job.save()
    } else if (status === 'rejected') {
      if (!rejectionReason) return res.status(400).json({ message: 'Rejection reason required' })
      app.status = 'rejected'
      app.rejectionReason = rejectionReason
    } else {
      return res.status(400).json({ message: 'Invalid status' })
    }

    await app.save()
    res.json({ message: 'Application updated', application: app })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})



export default router
