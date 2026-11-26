import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
const router = Router();

router.post("/register", register);
router.post("/login", login);

// Protected Route
router.get("/me", authenticateToken, getMe);

export default router;
