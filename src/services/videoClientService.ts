/**
 * @file videoClientService.ts
 * @description Service to manage video client selection based on environment configuration
 */

import { VideoClient as RealVideoClient } from "../clients/videoClient";
import { VideoClient as DemoVideoClient } from "../clients/videoClientDemo";
import { Logger } from "../utils/logger";
import { DEMO_MODE } from "../config/env";

/**
 * @interface VideoClientConfig
 * @description Configuration for creating a video client instance
 */
interface VideoClientConfig {
  /** @property {string} apiKey - API key for authentication */
  apiKey: string;
  /** @property {string} [baseUrl] - Base URL for the API */
  baseUrl?: string;
  /** @property {number} [timeout] - Default timeout in milliseconds */
  timeout?: number;
}

/**
 * @function getVideoClient
 * @description Factory function that returns the appropriate video client based on environment
 * @param {VideoClientConfig} config - Configuration for the video client
 * @returns {VideoClient} Instance of a video client (real or demo)
 */
export function getVideoClient(
  config: VideoClientConfig
): RealVideoClient | DemoVideoClient {
  // Use the imported DEMO_MODE constant from env.ts
  Logger.info(`VideoClientService: DEMO_MODE=${DEMO_MODE}`);

  if (DEMO_MODE) {
    Logger.info("Using Demo Video Client for video generation");
    return new DemoVideoClient(config);
  } else {
    Logger.info("Using Real Video Client for video generation");
    return new RealVideoClient(config);
  }
}

/**
 * Re-export the VideoClient class to maintain backward compatibility
 * This allows importing VideoClient directly from this service
 */
export { VideoClient } from "../clients/videoClient";
