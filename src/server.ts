/**
 * @file server.ts
 * @description Main server entry point
 */

import express from "express";
import cors from "cors";
import { Logger } from "./utils/logger";
import { getEnvConfig } from "./utils/checkEnv";
import a2aRoutes from "./routes/a2aRoutes";

// Initialize environment configuration
const config = getEnvConfig();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

app.use("/", a2aRoutes);
