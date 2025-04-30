/**
 * @file apiResponses.ts
 * @description Interfaces for Suno API responses and options
 */

import { TaskYieldUpdate } from "../interfaces/a2a";

/**
 * @interface SongOptions
 * @description Options for song generation including model and audio format preferences
 */
export interface SongOptions {
  /** @property {string} model - The model version to use for generation */
  model?: string;
  /** @property {string} format - The desired audio format for the output */
  format?: string;
  /** @property {number} duration - The target duration in seconds */
  duration?: number;
  /** @property {string} style - The musical style or genre */
  style?: string;
  /** @property {string} mood - The emotional mood of the song */
  mood?: string;
  /** @property {string} tempo - The speed/tempo of the song */
  tempo?: string;
}

/**
 * @interface GenerateSongResponse
 * @description Response from the song generation endpoint
 */
export interface GenerateSongResponse {
  /** @description Unique identifier for the generated song */
  id: string;
  /** @description Current status of the generation */
  status: string;
  /** @description Estimated completion time in seconds */
  estimatedTime?: number;
}

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

/**
 * @interface SongResponse
 * @description Response containing the generated song data
 */
export interface SongResponse {
  jobId: string;
  music: {
    musicId: string;
    title: string;
    audioUrl: string;
    duration: number;
  };
  metadata: {
    title: string;
    lyrics?: string;
    tags?: string[];
  };
}

/**
 * @interface SongGenerationOptions
 * @description Extended options for song generation including all possible parameters
 */
export interface SongGenerationOptions {
  /** @property {string} prompt - Description of the song to generate */
  prompt: string;
  /** @property {string} title - Title of the song */
  title?: string;
  /** @property {string} lyrics - Lyrics for the song */
  lyrics?: string;
  /** @property {string[]} tags - Array of tags describing the song */
  tags?: string[];
}

/**
 * @interface SongGenerationResponse
 * @description Response from the song generation endpoint with task tracking info
 * @extends GenerateSongResponse
 */
export interface SongGenerationResponse extends GenerateSongResponse {
  /** @property {string} [error] - Error message if generation failed */
  error?: string;
  /** @property {SongOptions} [options] - Options used for generation */
  options?: SongOptions;
}
