/**
 * @file apiResponses.ts
 * @description Interfaces for Suno API responses and options
 */

import { TaskYieldUpdate } from "../interfaces/a2a";

/**
 * @interface StatusData
 * @description Data about the current status of a song generation task
 */
export interface StatusData {
  /** @property {string} status - Current status of the task */
  status: "submitted" | "working" | "completed" | "failed" | "cancelled";
  /** @property {number} progress - Progress percentage */
  progress: number;
  /** @property {string} [error] - Error message if any */
  error?: string;
  /** @property {string} jobId - Unique identifier of the job */
  jobId: string;
}

/**
 * @interface StatusResponse
 * @description Response containing the current status of a generation task
 */
export interface StatusResponse {
  /** @property {string} status - Current status of the task */
  status: "submitted" | "working" | "completed" | "failed" | "cancelled";
  /** @property {number} progress - Progress percentage as a number */
  progress: number;
  /** @property {StatusData} [data] - Additional status information */
  data?: StatusData;
}

/**
 * @interface WaitForCompletionOptions
 * @description Options for waitForCompletion method
 */
export interface WaitForCompletionOptions {
  timeout?: number;
  interval?: number;
  onStatusUpdate?: (status: StatusData) => TaskYieldUpdate | null;
}

/** @interface GenerateVideoResponse */
export interface GenerateVideoResponse {
  /** @description Unique identifier for the generated video task */
  id: string;
  /** @description Current status of the generation */
  status: string;
  /** @description Estimated completion time in seconds */
  estimatedTime?: number;
}

/** @interface VideoResponse */
export interface VideoResponse {
  jobId: string;
  video: {
    videoId: string;
    url: string;
    duration: number;
  };
  metadata: {
    prompt: string;
    imageUrls?: string[];
    duration?: number;
  };
}

/** @interface GenerateImageResponse */
export interface GenerateImageResponse {
  /** @description Unique identifier for the generated image task */
  id: string;
  /** @description Current status of the generation */
  status: string;
  /** @description Estimated completion time in seconds */
  estimatedTime?: number;
}

/** @interface ImageResponse */
export interface ImageResponse {
  jobId: string;
  image: {
    imageId: string;
    url: string;
  };
  metadata: {
    prompt: string;
    inputImageUrl?: string;
  };
}
