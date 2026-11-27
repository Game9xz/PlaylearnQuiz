import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import questionSetRoutes from "./routes/question-set.routes";
import questionRoutes from "./routes/question.routes";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/question-sets", questionSetRoutes);
app.use("/api/question-sets", questionRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to PlayLearn API",
    status: "running",
  });
});

export default app;
