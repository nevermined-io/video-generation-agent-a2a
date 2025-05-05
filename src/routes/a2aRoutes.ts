/**
 * @file a2aRoutes.ts
 * @description Express routes for A2A functionality
 */

import express from "express";
import { A2AController } from "../controllers/a2aController";
import { getEnvConfig } from "../utils/checkEnv";

const router = express.Router();
const config = getEnvConfig();

// Initialize controller with config
const controller = new A2AController({
  falKey: config.FAL_KEY,
  piapiKey: config.PIAPI_KEY,
  maxConcurrent: config.MAX_CONCURRENT_TASKS,
  maxRetries: config.MAX_RETRIES,
  retryDelay: config.RETRY_DELAY,
});

// Health check
router.get("/health", controller.healthCheck);

// Agent information
router.get("/.well-known/agent.json", controller.getAgentCard);

// Task management
router.get("/tasks", controller.listTasks);
router.post("/tasks/send", controller.sendTask);
router.post("/tasks/sendSubscribe", controller.sendTaskSubscribe);
router.get("/tasks/:taskId", controller.getTaskStatus);
router.post("/tasks/:taskId/cancel", controller.cancelTask);
router.get("/tasks/:taskId/history", controller.getTaskHistory);

// Push notifications
router.post("/tasks/:taskId/notifications", controller.subscribeWebhook);
router.get("/tasks/:taskId/notifications", controller.subscribeSSE);

export default router;
