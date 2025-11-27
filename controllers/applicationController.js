import Application from '../models/Application.js';
import Job from '../models/Job.js';

// ================================
//  GET applicant's applications
// ================================
export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user.id })
      .populate('job', 'title company location')
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


// ===============================================
//  GET applications for a specific job (Recruiter)
// ===============================================
export const getJobApplications = async (req, res) => {
  try {
    if (req.user.role !== 'recruiter')
      return res.status(403).json({ message: 'Access denied' });

    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Check recruiter owns the job
    if (job.recruiter.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Access denied' });

    const apps = await Application.find({ job: job._id })
      .populate("applicant", "name email");

    res.json(apps);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};





// ====================================
//  UPDATE Application Status (Recruiter)
// ====================================
export const updateApplicationStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    // Load application & job
    const app = await Application.findById(req.params.appId)
      .populate('job', 'recruiter openings');

    if (!app) return res.status(404).json({ message: 'Application not found' });

    // Check recruiter owns this job
    if (app.job.recruiter.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // ====== SELECT ======
    if (status === 'selected') {
      if (app.job.openings <= 0) {
        return res.status(400).json({ message: 'No openings left' });
      }

      app.status = 'selected';
      app.rejectionReason = '';
      app.job.openings -= 1;

      await app.job.save();
      await app.save();

      return res.json({ message: "Applicant selected", application: app });
    }

    // ====== REJECT ======
    if (status === 'rejected') {
      if (!rejectionReason)
        return res.status(400).json({ message: "Rejection reason required" });

      app.status = 'rejected';
      app.rejectionReason = rejectionReason;

      await app.save();
      return res.json({ message: "Applicant rejected", application: app });
    }

    return res.status(400).json({ message: "Invalid status" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getApplicationsForJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;

    // 1. Find the job
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // 2. Check recruiter ownership
    if (job.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not allowed to view these applications" });
    }

    // 3. Fetch applications
    const applications = await Application.find({ job: jobId })
      .populate("applicant", "name email")
      .populate("job", "title company openings");

    res.json(applications);

  } catch (err) {
    console.error("APPLICATION FETCH ERROR:", err);
    res.status(500).json({ message: "Server error fetching applications" });
  }
};
