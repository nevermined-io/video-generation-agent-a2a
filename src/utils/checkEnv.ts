/**
 * @file checkEnv.ts
 * @description Environment validation utilities
 */

import { EnvConfig, defaultConfig, requiredEnvVars } from "../config/env";
import { Logger } from "./logger";

/**
 * @function validateEnv
 * @description Validates environment variables and returns a complete config
 * @returns {EnvConfig} Complete configuration with defaults
 * @throws {Error} If required environment variables are missing
 */
export function validateEnv(): EnvConfig {
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(
      ", "
    )}`;
    Logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Merge environment variables with defaults
  const config: EnvConfig = {
    ...defaultConfig,
    PORT: parseInt(process.env.PORT || defaultConfig.PORT!.toString(), 10),
    HOST: process.env.HOST || defaultConfig.HOST!,
    NODE_ENV: process.env.NODE_ENV || defaultConfig.NODE_ENV!,
    LOG_LEVEL: process.env.LOG_LEVEL || defaultConfig.LOG_LEVEL!,
    FAL_KEY: process.env.FAL_KEY!,
    PIAPI_KEY: process.env.PIAPI_KEY!,
    DEMO_MODE: process.env.DEMO_MODE === "true",
    MAX_CONCURRENT_TASKS: parseInt(
      process.env.MAX_CONCURRENT_TASKS ||
        defaultConfig.MAX_CONCURRENT_TASKS!.toString(),
      10
    ),
    MAX_RETRIES: parseInt(
      process.env.MAX_RETRIES || defaultConfig.MAX_RETRIES!.toString(),
      10
    ),
    RETRY_DELAY: parseInt(
      process.env.RETRY_DELAY || defaultConfig.RETRY_DELAY!.toString(),
      10
    ),
    TASK_TIMEOUT: parseInt(
      process.env.TASK_TIMEOUT || defaultConfig.TASK_TIMEOUT!.toString(),
      10
    ),
  } as EnvConfig;

  Logger.debug("Environment configuration:", config);
  return config;
}

/**
 * @function getEnvConfig
 * @description Gets the validated environment configuration
 * @returns {EnvConfig} Complete configuration
 */
export function getEnvConfig(): EnvConfig {
  return validateEnv();
}
