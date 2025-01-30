import { Logger } from "./logger";

/**
 * @function validateEnvironment
 * @description Verifies that required environment variables are set
 */
export function validateEnvironment(): void {
  const requiredVars = ["SUNO_API_KEY"];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      Logger.error(`Missing required environment variable: ${varName}`);
      process.exit(1);
    }
  });
}
