/**
 * @file imageClient.ts
 * @description Modern implementation of Fal.ai client for image generation
 */

import { fal } from "@fal-ai/client";
import { Logger } from "../utils/logger";
import {
  GenerateImageResponse,
  StatusResponse,
  ImageResponse,
  WaitForCompletionOptions,
  StatusData,
} from "../interfaces/apiResponses";
import { MediaError, MediaErrorCode } from "../errors/mediaError";

/**
 * @class ImageClient
 * @description Client for interacting with the Fal.ai image generation API
 */
export class ImageClient {
  private readonly apiKey: string;
  private jobIdMap: Map<string, string> = new Map(); // Maps taskId to Fal job id

  /**
   * @constructor
   * @param {Object} config - Configuration options for the Image client
   * @param {string} config.apiKey - API key for authentication
   */
  constructor(config: { apiKey: string }) {
    if (!config.apiKey) {
      throw new MediaError(
        MediaErrorCode.INVALID_API_KEY,
        400,
        "API key is required"
      );
    }
    this.apiKey = config.apiKey;
    // Set API key for fal client
    fal.config({ credentials: this.apiKey });
  }

  /**
   * @private
   * @method getJobId
   * @description Gets the Fal job id for a given taskId
   */
  private getJobId(taskId: string): string {
    const jobId = this.jobIdMap.get(taskId);
    if (!jobId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        `No jobId found for taskId: ${taskId}`
      );
    }
    return jobId;
  }

  /**
   * @method generateImage
   * @description Initiates the generation of a new image from a text prompt
   * @param {string} taskId - Our internal task ID
   * @param {string} prompt - The text prompt for image generation
   * @returns {Promise<GenerateImageResponse>} Response containing the task ID and initial status
   * @throws {MediaError} If the API request fails
   */
  async generateImage(
    taskId: string,
    prompt: string
  ): Promise<GenerateImageResponse> {
    if (!prompt) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Prompt is required"
      );
    }
    try {
      Logger.debug(
        `Generating image for taskId ${taskId} with prompt: ${prompt}`
      );
      const result = await fal.subscribe("fal-ai/flux/schnell", {
        input: {
          prompt: prompt,
          image_size: "landscape_16_9",
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        },
        logs: true,
      });
      if (!result?.requestId) {
        throw new MediaError(
          MediaErrorCode.API_ERROR,
          500,
          "No requestId received from Fal.ai."
        );
      }
      this.jobIdMap.set(taskId, result.requestId);
      return {
        id: taskId,
        status: "submitted",
        estimatedTime: 10,
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        `Network error during image generation: ${error}`
      );
    }
  }

  /**
   * @method generateImageToImage
   * @description Initiates the generation of a new image from an input image and prompt
   * @param {string} taskId - Our internal task ID
   * @param {string} inputImageUrl - The URL of the input image
   * @param {string} prompt - The text prompt for image transformation
   * @returns {Promise<GenerateImageResponse>} Response containing the task ID and initial status
   * @throws {MediaError} If the API request fails
   */
  async generateImageToImage(
    taskId: string,
    inputImageUrl: string,
    prompt: string
  ): Promise<GenerateImageResponse> {
    if (!inputImageUrl || !prompt) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Input image URL and prompt are required"
      );
    }
    try {
      Logger.debug(`Generating image-to-image for taskId ${taskId}`);
      const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
        input: {
          image_url: inputImageUrl,
          prompt: prompt,
          strength: 0.95,
          num_inference_steps: 40,
          guidance_scale: 5,
          num_images: 1,
          enable_safety_checker: true,
        },
        logs: true,
      });
      if (!result?.requestId) {
        throw new MediaError(
          MediaErrorCode.API_ERROR,
          500,
          "No requestId received from Fal.ai."
        );
      }
      this.jobIdMap.set(taskId, result.requestId);
      return {
        id: taskId,
        status: "submitted",
        estimatedTime: 20,
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        `Network error during image-to-image generation: ${error}`
      );
    }
  }

  /**
   * @method checkStatus
   * @description Checks the status of an image generation task
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<StatusResponse>} Current status of the generation task
   * @throws {MediaError} If the status check fails
   */
  async checkStatus(taskId: string): Promise<StatusResponse> {
    if (!taskId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Task ID is required"
      );
    }
    try {
      const jobId = this.getJobId(taskId);
      Logger.debug(
        `Checking status for taskId ${taskId} with Fal job id ${jobId}`
      );
      const result = await fal.queue.status("fal-ai/flux/schnell", {
        requestId: jobId,
        logs: true,
      });
      const status = result.status === "COMPLETED" ? "completed" : "working";
      const progress = status === "completed" ? 100 : 0;
      const statusData: StatusData = {
        status: status,
        progress: progress,
        jobId: jobId,
      };
      return {
        status: status,
        progress: progress,
        data: statusData,
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        "Network error during status check"
      );
    }
  }

  /**
   * @method waitForCompletion
   * @description Waits for an image generation task to complete
   * @param {string} taskId - Our internal task ID
   * @param {Object} [options] - Options for the wait operation
   * @returns {AsyncGenerator<StatusData, ImageResponse>} Generator that yields status updates and returns image data
   * @throws {MediaError} If the wait operation times out or fails
   */
  async *waitForCompletion(
    taskId: string,
    options: WaitForCompletionOptions = {}
  ): AsyncGenerator<StatusData, ImageResponse> {
    const { timeout = 180000, interval = 3000, onStatusUpdate } = options;
    const startTime = Date.now();
    const jobId = this.getJobId(taskId);
    Logger.debug(
      `Waiting for completion of taskId ${taskId} with Fal job id ${jobId}`
    );
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new MediaError(
          MediaErrorCode.TIMEOUT,
          408,
          `Image generation timed out after ${timeout}ms`
        );
      }
      const result = await fal.queue.status("fal-ai/flux/schnell", {
        requestId: jobId,
        logs: true,
      });
      const status = result.status === "COMPLETED" ? "completed" : "working";
      const progress = status === "completed" ? 100 : 0;
      const statusData: StatusData = {
        status: status,
        progress: progress,
        jobId: jobId,
      };
      if (onStatusUpdate) {
        onStatusUpdate(statusData);
      }
      yield statusData;
      if (status === "completed") {
        return await this.getImage(taskId);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * @method getImage
   * @description Retrieves the generated image data once complete
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<ImageResponse>} Generated image data including download URL
   * @throws {MediaError} If the image retrieval fails
   */
  async getImage(taskId: string): Promise<ImageResponse> {
    if (!taskId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Task ID is required"
      );
    }
    try {
      const jobId = this.getJobId(taskId);
      Logger.debug(
        `Getting image for taskId ${taskId} with Fal job id ${jobId}`
      );
      const result = await fal.queue.result("fal-ai/flux/schnell", {
        requestId: jobId,
      });
      if (!result.data?.images?.[0]?.url) {
        throw new MediaError(
          MediaErrorCode.GENERATION_FAILED,
          500,
          `Image not ready or failed.`
        );
      }
      return {
        jobId: jobId,
        image: {
          imageId: jobId,
          url: result.data.images[0].url,
        },
        metadata: {
          prompt: "",
          inputImageUrl: undefined,
        },
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        "Network error during image retrieval"
      );
    }
  }
}
