import { Router } from "express";
import {
  createQuestionSetController,
  getAllQuestionSetsController,
  getQuestionSetByIdController,
} from "../controllers/question-set.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { updateQuestionSetController } from "../controllers/question-set.controller";
import { deleteQuestionSetController } from "../controllers/question-set.controller";

const router = Router();

// Create Question Set
router.post("/", authenticateToken, createQuestionSetController);

// Get All Question Sets
router.get("/", authenticateToken, getAllQuestionSetsController);
// Get Question Set by ID
router.get("/:id", authenticateToken, getQuestionSetByIdController);

// Update Question Set
router.put("/:id", authenticateToken, updateQuestionSetController);

// Delete Question Set
router.delete("/:id", authenticateToken, deleteQuestionSetController);

export default router;
