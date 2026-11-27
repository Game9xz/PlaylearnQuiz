import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";

import {
  createQuestionController,
  getAllQuestionsController,
  getQuestionByIdController,
  updateQuestionController,
  deleteQuestionController,
} from "../controllers/question.controller";

const router = Router();

// Create Question
router.post("/:id/questions", authenticateToken, createQuestionController);

// Get All Questions
router.get("/:id/questions", authenticateToken, getAllQuestionsController);
router.get(
  "/:id/questions/:questionId",
  authenticateToken,
  getQuestionByIdController,
);

// Update Question
router.put(
  "/:id/questions/:questionId",
  authenticateToken,
  updateQuestionController,
);

// Delete Question
router.delete(
  "/:id/questions/:questionId",
  authenticateToken,
  deleteQuestionController,
);

export default router;
