// routes/authRoutes.js
import express from "express";
import {
  registerUser,
  loginUser,
  getProfile,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", auth, getProfile);

export default router;
