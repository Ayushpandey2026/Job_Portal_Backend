import User from '../models/User.js';

// @desc    Get applicant profile
// @route   GET /api/applicant/profile
// @access  Private (applicant)
export const getApplicantProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user || user.role !== 'applicant') {
      return res.status(404).json({ message: 'Applicant profile not found' });
    }

    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update applicant profile
// @route   PUT /api/applicant/profile
// @access  Private (applicant)
export const updateApplicantProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'applicant') {
      return res.status(404).json({ message: 'Applicant profile not found' });
    }

    // Update profile fields
    Object.assign(user.profile, req.body.profile || {});
    if (req.body.phone) user.phone = req.body.phone;

    const updatedUser = await user.save();
    const safeUser = await User.findById(user._id).select('-password');
    res.json(safeUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload resume (will handle file upload)
// @route   POST /api/applicant/resume-upload
// @access  Private
export const uploadResume = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'applicant') {
      return res.status(404).json({ message: 'Applicant not found' });
    }
    // Assume req.file from multer
    user.profile.resumeUrl = req.file ? `/uploads/${req.file.filename}` : user.profile.resumeUrl;
    await user.save();
    res.json({ resumeUrl: user.profile.resumeUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
