/**
 * @file setup.ts
 * @description Test setup and environment configuration
 */

import dotenv from "dotenv";
import path from "path";

// Load .env file first
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

// Setup test environment variables if needed
process.env.NODE_ENV = "test";
process.env.PORT = "8001"; // Use different port for testing

// Only set API keys if they don't exist in the environment
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-openai-key";
}
if (!process.env.SUNO_API_KEY) {
  process.env.SUNO_API_KEY = "test-suno-key";
}

// Add any global test setup here
