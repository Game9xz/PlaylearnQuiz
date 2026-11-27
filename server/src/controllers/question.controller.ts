import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  type UpdateQuestionInput,
} from "../services/question.service";

// Validation Schema
const createQuestionSchema = z
  .object({
    question_text: z.string().trim().min(1).max(2000),

    time_limit: z.number().int().min(5).max(300),

    points: z.number().int().min(1),

    options: z
      .array(
        z.object({
          option_key: z.enum(["A", "B", "C", "D"]),
          option_text: z.string().trim().min(1).max(1000),
          is_correct: z.boolean(),
        }),
      )
      .length(4),
  })
  .superRefine((data, ctx) => {
    const keys = data.options.map((option) => option.option_key);
    const correctCount = data.options.filter(
      (option) => option.is_correct,
    ).length;

    if (new Set(keys).size !== 4) {
      ctx.addIssue({
        code: "custom",
        message: "Option keys must be unique",
        path: ["options"],
      });
    }

    if (correctCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one option must be correct",
        path: ["options"],
      });
    }
  });

// Create Question
export async function createQuestionController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Validate Question Set ID
    const setId = req.params.id;

    if (typeof setId !== "string" || !/^[1-9]\d*$/.test(setId)) {
      return res.status(400).json({
        message: "Invalid question set ID",
      });
    }

    // 2. Get User ID
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 3. Validate Request Body
    const validation = createQuestionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: validation.error.issues,
      });
    }

    // 4. Create Question
    const result = await createQuestion(setId, userId, {
      questionText: validation.data.question_text,
      timeLimit: validation.data.time_limit,
      points: validation.data.points,
      options: validation.data.options.map((option) => ({
        optionKey: option.option_key,
        optionText: option.option_text,
        isCorrect: option.is_correct,
      })),
    });

    // 5. Check Result
    if (result.status === "NOT_FOUND") {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    // 6. Success
    return res.status(201).json({
      message: "Question created successfully",
      question: result.question,
    });
  } catch (error) {
    console.error("Create question error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getAllQuestionsController(
  req: AuthRequest,
  res: Response,
) {
  try {
    const setId = req.params.id;

    if (typeof setId !== "string" || !/^[1-9]\d*$/.test(setId)) {
      return res.status(400).json({
        message: "Invalid question set ID",
      });
    }

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const questions = await getAllQuestions(setId, userId);

    if (questions === null) {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    return res.status(200).json({
      message: "Questions retrieved successfully",
      total: questions.length,
      questions,
    });
  } catch (error) {
    console.error("Get all questions error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getQuestionByIdController(
  req: AuthRequest,
  res: Response,
) {
  try {
    const { id, questionId } = req.params;

    if (
      typeof id !== "string" ||
      typeof questionId !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      !/^[1-9]\d*$/.test(questionId)
    ) {
      return res.status(400).json({
        message: "Invalid ID",
      });
    }

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const result = await getQuestionById(id, questionId, userId);

    if (result.status === "SET_NOT_FOUND") {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    if (result.status === "QUESTION_NOT_FOUND") {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    return res.status(200).json({
      message: "Question retrieved successfully",
      question: result.question,
    });
  } catch (error) {
    console.error("Get Question By ID Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

const updateQuestionSchema = z
  .object({
    question_text: z.string().trim().min(1).max(2000),

    time_limit: z.number().int().min(5).max(300),

    points: z.number().int().min(1),

    options: z
      .array(
        z.object({
          option_key: z.enum(["A", "B", "C", "D"]),
          option_text: z.string().trim().min(1).max(1000),
          is_correct: z.boolean(),
        }),
      )
      .length(4),
  })
  .superRefine((data, ctx) => {
    const keys = data.options.map((option) => option.option_key);

    if (new Set(keys).size !== 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Option keys must be unique",
        path: ["options"],
      });
    }

    const correctAnswers = data.options.filter((option) => option.is_correct);

    if (correctAnswers.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one option must be correct",
        path: ["options"],
      });
    }
  });

export async function updateQuestionController(
  req: AuthRequest,
  res: Response,
) {
  try {
    const { id, questionId } = req.params;

    // ตรวจสอบ ID
    if (
      typeof id !== "string" ||
      typeof questionId !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      !/^[1-9]\d*$/.test(questionId)
    ) {
      return res.status(400).json({
        message: "Invalid ID",
      });
    }

    // ตรวจสอบ Token
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // Validate Request Body
    const validation = updateQuestionSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten(),
      });
    }

    // แปลงข้อมูลจาก snake_case เป็น camelCase
    const data: UpdateQuestionInput = {
      questionText: validation.data.question_text,
      timeLimit: validation.data.time_limit,
      points: validation.data.points,
      options: validation.data.options.map((option) => ({
        optionKey: option.option_key,
        optionText: option.option_text,
        isCorrect: option.is_correct,
      })),
    };

    // เรียกใช้ Service
    const result = await updateQuestion(id, questionId, userId, data);

    if (result.status === "SET_NOT_FOUND") {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    if (result.status === "QUESTION_NOT_FOUND") {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    return res.status(200).json({
      message: "Question updated successfully",
      question: result.question,
    });
  } catch (error) {
    console.error("Update Question Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function deleteQuestionController(
  req: AuthRequest,
  res: Response,
) {
  try {
    const { id, questionId } = req.params;

    if (
      typeof id !== "string" ||
      typeof questionId !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      !/^[1-9]\d*$/.test(questionId)
    ) {
      return res.status(400).json({
        message: "Invalid ID",
      });
    }

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const result = await deleteQuestion(id, questionId, userId);

    if (result.status === "SET_NOT_FOUND") {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    if (result.status === "QUESTION_NOT_FOUND") {
      return res.status(404).json({
        message: "Question not found",
      });
    }

    return res.status(200).json({
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Delete Question Error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
