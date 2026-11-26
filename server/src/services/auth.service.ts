import { pool } from "../config/database";
import bcrypt from "bcrypt";

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export async function registerUser(data: RegisterInput) {
  // 1. Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // 2. Insert user into PostgreSQL
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING user_id, username, email, created_at`,
    [data.username, data.email, hashedPassword],
  );

  // 3. Return created user
  return result.rows[0];
}

export async function loginUser(email: string, password: string) {
  // 1. Find user by email
  const result = await pool.query(
    `SELECT user_id, username, email, password_hash
         FROM users
         WHERE email = $1`,
    [email],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  // 2. Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    return null;
  }

  // 3. Return user without password
  return {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
  };
}

export async function getUserById(userId: string) {
  const result = await pool.query(
    `SELECT user_id, username, email, created_at
         FROM users
         WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] || null;
}
