## JobWallah Backend 🚀

A scalable Node.js + Express backend powering the JobWallah Job Portal, handling authentication, job management, application processing, resume uploads, and AI-based ATS resume scoring.

The backend exposes RESTful APIs used by the frontend to manage recruiters, applicants, job postings, and applications.

## Tech Stack
Technology	Purpose
Node.js	Runtime environment
Express.js	Backend framework
MongoDB	Database
Mongoose	MongoDB ODM
JWT	Authentication
Multer	Resume file upload
pdf-parse	Extract text from uploaded resumes
Google Gemini API	AI-based ATS resume scoring
dotenv	Environment variable management
Features
Authentication

User registration and login

JWT based secure authentication

Role based access control (Recruiter / Applicant)

Job Management

Recruiters can create jobs

Update and manage job listings

View all posted jobs

Filter jobs by category, title, location, etc.

Application System

Applicants can apply to jobs

Resume upload supported

Applications stored with ATS score

Prevent duplicate applications

Resume Analysis (AI)

Resume text extracted from PDF

Gemini AI analyzes resume against job description

Generates ATS compatibility score (0–100)

Recruiter Dashboard APIs

View applications for their jobs

Filter applicants by ATS score

Accept or reject applications

Add rejection feedback

Automated Job Opening Update

When recruiter selects an applicant

Job openings automatically decrease by 1

# Folder Structure
<pre>
backend
│
├── models
│   ├── User.js
│   ├── Job.js
│   ├── Application.js
│   └── ResumeCheck.js
│
├── routes
│   ├── auth.js
│   ├── jobs.js
│   ├── applications.js
│   └── resume.js
│
├── middleware
│   └── auth.js
│
├── uploads
│   └── (uploaded resumes stored here)
│
├── server.js
├── package.json
└── .env
</pre> 


# Environment Variables

Create a .env file inside the backend directory.

PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

GEMINI_API_KEY=your_gemini_api_key
Installation

Clone the repository

git clone https://github.com/Ayushpandey2026/Job_Portal.git

Move to backend folder

cd Job_Portal/backend

Install dependencies

npm install

Start the server

node server.js


## Future Improvements

Resume keyword highlighting

Email notifications

Admin dashboard

AI interview evaluation

Cloud storage for resumes

# Author

Ayush Pandey

Full Stack Developer
React | Node.js | MongoDB | AI Integration

GitHub
https://github.com/Ayushpandey2026
