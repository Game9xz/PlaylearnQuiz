import { Request, Response } from "express";
import { z } from "zod";
import { registerUser } from "../services/auth.service";
import jwt from "jsonwebtoken";
import { loginUser } from "../services/auth.service";
import { getUserById } from "../services/auth.service";
import { AuthRequest } from "../middlewares/auth.middleware";

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function register(req: Request, res: Response) {
  try {
    // 1. Validate request body
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: validation.error.issues,
      });
    }

    // 2. Register user
    const user = await registerUser(validation.data);

    // 3. Generate JWT
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" },
    );

    // 4. Send response
    return res.status(201).json({
      message: "Registration successful",
      token,
      user,
    });
  } catch (error: any) {
    // Duplicate username or email
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Username or email already exists",
      });
    }

    console.error("Register error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response) {
  try {
    // Validate input
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: validation.error.issues,
      });
    }

    const { email, password } = validation.data;

    // Login user
    const user = await loginUser(email, password);

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    // Generate token
    const token = jwt.sign({ userId: user.user_id }, secret, {
      expiresIn: "1d",
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
