/**
 * @file video.ts
 * @description Types for video generation process
 */

/**
 * @enum VideoGenerationState
 * @description States specific to the video generation process
 */
export enum VideoGenerationState {
  VIDEO_GENERATION = "video_generation",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * @interface VideoMetadata
 * @description Metadata structure for a generated video
 */
export interface VideoMetadata {
  prompt: string;
  imageUrls?: string[];
  duration?: number;
}

/**
 * @interface VideoGenerationOptions
 * @description Options for video generation
 */
export interface VideoGenerationOptions {
  prompt: string;
  imageUrls?: string[];
  duration?: number;
}

/**
 * @interface VideoGenerationResult
 * @description Final result of video generation process
 */
export interface VideoGenerationResult {
  jobId: string;
  video: {
    videoId: string;
    url: string;
    duration: number;
  };
  metadata: VideoMetadata;
}
