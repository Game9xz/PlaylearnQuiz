import { Request, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middlewares/auth.middleware";
import { createQuestionSet } from "../services/question-set.service";
import { getAllQuestionSets } from "../services/question-set.service";
import { getQuestionSetById } from "../services/question-set.service";
import { updateQuestionSet } from "../services/question-set.service";
import { deleteQuestionSet } from "../services/question-set.service";

// Validation Schema
const createQuestionSetSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().optional(),
  is_public: z.boolean().default(false),
});

// Create Question Set
export async function createQuestionSetController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Validate request body
    const validation = createQuestionSetSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: validation.error.issues,
      });
    }

    // 2. Get user ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 3. Create Question Set
    const questionSet = await createQuestionSet({
      userId,
      title: validation.data.title,
      description: validation.data.description,
      isPublic: validation.data.is_public,
    });

    // 4. Return response
    return res.status(201).json({
      message: "Question set created successfully",
      questionSet,
    });
  } catch (error) {
    console.error("Create question set error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getAllQuestionSetsController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Get user ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 2. Get Question Sets
    const questionSets = await getAllQuestionSets(userId);

    // 3. Return response
    return res.status(200).json({
      message: "Question sets retrieved successfully",
      total: questionSets.length,
      questionSets,
    });
  } catch (error) {
    console.error("Get question sets error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getQuestionSetByIdController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Validate ID
    const setId = req.params.id;

    if (typeof setId !== "string" || !/^[1-9]\d*$/.test(setId)) {
      return res.status(400).json({
        message: "Invalid question set ID",
      });
    }

    // 2. Get user ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 3. Get Question Set
    const questionSet = await getQuestionSetById(setId, userId);

    if (!questionSet) {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    // 4. Return response
    return res.status(200).json({
      message: "Question set retrieved successfully",
      questionSet,
    });
  } catch (error) {
    console.error("Get question set error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateQuestionSetController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Validate ID
    const setId = req.params.id;

    if (typeof setId !== "string" || !/^[1-9]\d*$/.test(setId)) {
      return res.status(400).json({
        message: "Invalid question set ID",
      });
    }

    // 2. Get User ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 3. Get request body
    const { title, description, is_public } = req.body;

    // 4. Validate input
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150
    ) {
      return res.status(400).json({
        message: "Title is required and must not exceed 150 characters",
      });
    }

    if (typeof description !== "string") {
      return res.status(400).json({
        message: "Description must be a string",
      });
    }

    if (typeof is_public !== "boolean") {
      return res.status(400).json({
        message: "is_public must be a boolean",
      });
    }

    // 5. Update Question Set
    const updatedQuestionSet = await updateQuestionSet(
      setId,
      userId,
      title.trim(),
      description.trim(),
      is_public,
    );

    if (!updatedQuestionSet) {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    // 6. Return response
    return res.status(200).json({
      message: "Question set updated successfully",
      questionSet: updatedQuestionSet,
    });
  } catch (error) {
    console.error("Update question set error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function deleteQuestionSetController(
  req: AuthRequest,
  res: Response,
) {
  try {
    // 1. Validate ID
    const setId = req.params.id;

    if (typeof setId !== "string" || !/^[1-9]\d*$/.test(setId)) {
      return res.status(400).json({
        message: "Invalid question set ID",
      });
    }

    // 2. Get User ID from JWT
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    // 3. Delete Question Set
    const result = await deleteQuestionSet(setId, userId);

    // 4. Check result
    if (result.status === "NOT_FOUND") {
      return res.status(404).json({
        message: "Question set not found",
      });
    }

    if (result.status === "IN_USE") {
      return res.status(409).json({
        message:
          "Cannot delete question set because it is used by existing rooms",
      });
    }

    // 5. Success
    return res.status(200).json({
      message: "Question set deleted successfully",
    });
  } catch (error) {
    console.error("Delete question set error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
