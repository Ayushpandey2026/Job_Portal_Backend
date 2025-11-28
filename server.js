import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRoutes from "./routes/adminRoutes.js";


// Load environment variables
dotenv.config();

// Import Routes
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import applicationRoutes from './routes/applications.js';
import resumeRoutes from './routes/resume.js';

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== Multer Configuration ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ========== Middlewares ==========
app.use(cors({
  origin: [
    'https://jobwallah.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== MongoDB Connection ==========
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-portal')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

console.log("Loaded JWT_SECRET =", process.env.JWT_SECRET ? "Yes" : "No");

// ========== API Routes ==========
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/resume', resumeRoutes);
app.use("/api/admin", adminRoutes);

// Health check (Render)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// ========== Start Server ==========
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
