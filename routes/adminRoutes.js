import express from "express";
import auth from "../middleware/auth.js";
import {isAdmin} from "../middleware/checkAdmin.js";
import * as admin from "../controllers/adminController.js";

const router = express.Router();

router.get("/users", auth, isAdmin, admin.getAllUsers);
router.put("/users/block/:userId", auth, isAdmin, admin.blockUser);
router.put("/users/unblock/:userId", auth, isAdmin, admin.unblockUser);

router.get("/jobs", auth, isAdmin, admin.getAllJobs);
router.delete("/jobs/:jobId", auth, isAdmin, admin.deleteJob);

router.get("/analytics", auth, isAdmin, admin.getAnalytics);

export default router;
