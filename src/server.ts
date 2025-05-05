/**
 * @file server.ts
 * @description Main server entry point
 */

import express from "express";
import cors from "cors";
import { Logger } from "./utils/logger";
import { getEnvConfig } from "./utils/checkEnv";
import A2AController from "./controllers/a2aController";

// Initialize environment configuration
const config = getEnvConfig();

// Initialize A2A controller with config
const a2aController = new A2AController({
  openAiKey: config.OPENAI_API_KEY,
  sunoKey: config.SUNO_API_KEY,
  maxConcurrent: config.MAX_CONCURRENT_TASKS,
  maxRetries: config.MAX_RETRIES,
  retryDelay: config.RETRY_DELAY,
});

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/health", a2aController.healthCheck);
app.get("/.well-known/agent.json", a2aController.getAgentCard);
app.get("/tasks", a2aController.listTasks);
app.post("/tasks/send", a2aController.sendTask);
app.post("/tasks/sendSubscribe", a2aController.sendTaskSubscribe);
app.get("/tasks/:taskId", a2aController.getTaskStatus);
app.get("/tasks/:taskId/history", a2aController.getTaskHistory);
app.post("/tasks/:taskId/notifications", a2aController.subscribeWebhook);
app.get("/tasks/:taskId/notifications", a2aController.subscribeSSE);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    Logger.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
app.listen(config.PORT, config.HOST, () => {
  Logger.info(`Server running at http://${config.HOST}:${config.PORT}`);
  Logger.info(`Environment: ${config.NODE_ENV}`);
  Logger.info(`Log level: ${config.LOG_LEVEL}`);
});
