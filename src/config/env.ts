/**
 * @file env.ts
 * @description Environment configuration and validation
 */

import dotenv from "dotenv";

dotenv.config();

export const NVM_API_KEY = process.env.NVM_API_KEY!;
export const NVM_ENVIRONMENT = process.env.NVM_ENVIRONMENT || "testing";
export const AGENT_DID = process.env.AGENT_DID!;
export const SUNO_API_KEY = process.env.SUNO_API_KEY!;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export interface EnvConfig {
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  LOG_LEVEL: string;
  OPENAI_API_KEY: string;
  SUNO_API_KEY: string;
  FAL_KEY: string;
  PIAPI_KEY: string;
  MAX_CONCURRENT_TASKS: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  TASK_TIMEOUT: number;
  DEMO_MODE: boolean;
}

/**
 * @constant defaultConfig
 * @description Default configuration values
 */
export const defaultConfig: Partial<EnvConfig> = {
  PORT: 8003,
  HOST: "localhost",
  NODE_ENV: "development",
  LOG_LEVEL: "info",
  MAX_CONCURRENT_TASKS: 10,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TASK_TIMEOUT: 300000, // 5 minutes
  FAL_KEY: "",
  PIAPI_KEY: "",
  DEMO_MODE: false,
};

/**
 * @constant requiredEnvVars
 * @description List of required environment variables
 */
export const requiredEnvVars: (keyof EnvConfig)[] = [
  "FAL_KEY",
  "PIAPI_KEY",
  "DEMO_MODE",
];
