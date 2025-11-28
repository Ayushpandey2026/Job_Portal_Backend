import User from "../models/User.js";
import Job from "../models/Job.js";
import Application from "../models/Application.js";

export const getAllUsers = async (req, res) => {
  const users = await User.find({});
  res.json({ success: true, users });
};

export const blockUser = async (req, res) => {
  await User.findByIdAndUpdate(req.params.userId, { isBlocked: true });
  res.json({ success: true, message: "User blocked" });
};

export const unblockUser = async (req, res) => {
  await User.findByIdAndUpdate(req.params.userId, { isBlocked: false });
  res.json({ success: true, message: "User unblocked" });
};

export const getAllJobs = async (req, res) => {
  const jobs = await Job.find({}).populate("recruiter", "name email");
  res.json({ success: true, jobs });
};

export const deleteJob = async (req, res) => {
  await Job.findByIdAndDelete(req.params.jobId);
  res.json({ success: true, message: "Job deleted" });
};

export const getAnalytics = async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalRecruiters = await User.countDocuments({ role: "recruiter" });
  const totalApplicants = await User.countDocuments({ role: "applicant" });

  const totalJobs = await Job.countDocuments();
  const totalApplications = await Application.countDocuments();

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalRecruiters,
      totalApplicants,
      totalJobs,
      totalApplications
    }
  });
};
