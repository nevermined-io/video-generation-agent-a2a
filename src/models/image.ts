/**
 * @file image.ts
 * @description Types for image generation process
 */

/**
 * @enum ImageGenerationState
 * @description States specific to the image generation process
 */
export enum ImageGenerationState {
  IMAGE_GENERATION = "image_generation",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * @interface ImageMetadata
 * @description Metadata structure for a generated image
 */
export interface ImageMetadata {
  prompt: string;
  inputImageUrl?: string;
}

/**
 * @interface ImageGenerationOptions
 * @description Options for image generation
 */
export interface ImageGenerationOptions {
  prompt: string;
  inputImageUrl?: string;
}

/**
 * @interface ImageGenerationResult
 * @description Final result of image generation process
 */
export interface ImageGenerationResult {
  jobId: string;
  image: {
    imageId: string;
    url: string;
  };
  metadata: ImageMetadata;
}
