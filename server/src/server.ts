import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { pool } from "./config/database";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected successfully!");

    app.listen(PORT, () => {
      console.log(`🚀 PlayLearn API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }
}

startServer();
