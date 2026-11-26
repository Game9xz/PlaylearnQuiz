import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    // Check Bearer Token
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Access denied. Token required.",
      });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        message: "Server configuration error",
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      (typeof decoded.userId !== "string" && typeof decoded.userId !== "number")
    ) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    // Attach user information to request
    req.user = {
      userId: String(decoded.userId),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
