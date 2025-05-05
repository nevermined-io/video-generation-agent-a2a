/**
 * @file videoClient.ts
 * @description Modern implementation of PiAPI client for video generation
 */

import axios, { AxiosResponse } from "axios";
import { Logger } from "../utils/logger";
import {
  GenerateVideoResponse,
  StatusResponse,
  VideoResponse,
  WaitForCompletionOptions,
  StatusData,
} from "../interfaces/apiResponses";

// Puedes reutilizar SunoError si quieres unificar la gestión de errores
import { MediaError, MediaErrorCode } from "../errors/mediaError";

/**
 * @class VideoClient
 * @description Client for interacting with the PiAPI video generation API
 */
export class VideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private jobIdMap: Map<string, string> = new Map(); // Maps taskId to PiAPI task_id

  /**
   * @constructor
   * @param {Object} config - Configuration options for the Video client
   * @param {string} config.apiKey - API key for authentication
   * @param {string} [config.baseUrl] - Base URL for the API (optional)
   * @param {number} [config.timeout] - Default timeout in milliseconds (optional)
   */
  constructor(config: { apiKey: string; baseUrl?: string; timeout?: number }) {
    if (!config.apiKey) {
      throw new MediaError(
        MediaErrorCode.INVALID_API_KEY,
        400,
        "API key is required"
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.piapi.ai/api/v1";
    this.defaultTimeout = config.timeout || 30000;
  }

  /**
   * @private
   * @method getRequestHeaders
   * @description Returns the necessary headers for API requests
   */
  private getRequestHeaders() {
    return {
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    };
  }

  /**
   * @private
   * @method getJobId
   * @description Gets the PiAPI task_id for a given taskId
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
   * @method generateVideo
   * @description Initiates the generation of a new video with the specified options
   * @param {string} taskId - Our internal task ID
   * @param {string[]} imageUrls - List of image URLs to use as reference
   * @param {string} prompt - The text prompt for video generation
   * @param {number} [duration=5] - Duration of the video in seconds (5 or 10)
   * @returns {Promise<GenerateVideoResponse>} Response containing the task ID and initial status
   * @throws {MediaError} If the API request fails
   */
  async generateVideo(
    taskId: string,
    imageUrls: string[],
    prompt: string,
    duration: number = 5
  ): Promise<GenerateVideoResponse> {
    if (!prompt) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Prompt is required"
      );
    }
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "At least one image URL is required"
      );
    }
    if (![5, 10].includes(duration)) {
      duration = 10;
    }
    const payload = {
      model: "kling",
      task_type: "video_generation",
      input: {
        prompt: prompt,
        negative_prompt: "",
        duration,
        elements: imageUrls.map((url) => ({ image_url: url })),
        mode: "std",
        aspect_ratio: "16:9",
        version: "1.6",
      },
      config: {
        service_mode: "public",
        webhook_config: {
          endpoint: "",
          secret: "",
        },
      },
    };
    try {
      const response = await axios.post(
        `${this.baseUrl}/task`,
        payload,
        this.getRequestHeaders()
      );
      if (!response.data?.data?.task_id) {
        throw new MediaError(
          MediaErrorCode.API_ERROR,
          500,
          "No task_id received from PiAPI."
        );
      }
      const piapiTaskId = response.data.data.task_id;
      this.jobIdMap.set(taskId, piapiTaskId);
      Logger.debug(`Mapped taskId ${taskId} to PiAPI task_id ${piapiTaskId}`);
      return {
        id: taskId,
        status: response.data.data.status || "submitted",
        estimatedTime: duration,
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        `Network error during video generation: ${error}`
      );
    }
  }

  /**
   * @method checkStatus
   * @description Checks the status of a video generation task
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
        `Checking status for taskId ${taskId} with PiAPI task_id ${jobId}`
      );
      const response = await axios.get(
        `${this.baseUrl}/task/${jobId}`,
        this.getRequestHeaders()
      );
      const status = response.data.data.status;
      const progress = response.data.data.progress || 0;
      const statusData: StatusData = {
        status: status,
        progress: progress,
        jobId: jobId,
        error: response.data.data.error,
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
   * @description Waits for a video generation task to complete
   * @param {string} taskId - Our internal task ID
   * @param {Object} [options] - Options for the wait operation
   * @returns {AsyncGenerator<StatusData, VideoResponse>} Generator that yields status updates and returns video data
   * @throws {MediaError} If the wait operation times out or fails
   */
  async *waitForCompletion(
    taskId: string,
    options: WaitForCompletionOptions = {}
  ): AsyncGenerator<StatusData, VideoResponse> {
    const { timeout = 300000, interval = 5000, onStatusUpdate } = options;
    const startTime = Date.now();
    const jobId = this.getJobId(taskId);
    Logger.debug(
      `Waiting for completion of taskId ${taskId} with PiAPI task_id ${jobId}`
    );
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new MediaError(
          MediaErrorCode.TIMEOUT,
          408,
          `Video generation timed out after ${timeout}ms`
        );
      }
      const response = await axios.get(
        `${this.baseUrl}/task/${jobId}`,
        this.getRequestHeaders()
      );
      const status = response.data.data.status;
      const progress = response.data.data.progress || 0;
      const statusData: StatusData = {
        status: status,
        progress: progress,
        jobId: jobId,
        error: response.data.data.error,
      };
      if (onStatusUpdate) {
        onStatusUpdate(statusData);
      }
      yield statusData;
      if (status === "completed") {
        return await this.getVideo(taskId);
      } else if (status === "failed" || status === "cancelled") {
        throw new MediaError(
          MediaErrorCode.GENERATION_FAILED,
          500,
          `Task ${status}: Task ${jobId} has failed or was cancelled.`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * @method getVideo
   * @description Retrieves the generated video data once complete
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<VideoResponse>} Generated video data including download URL
   * @throws {MediaError} If the video retrieval fails
   */
  async getVideo(taskId: string): Promise<VideoResponse> {
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
        `Getting video for taskId ${taskId} with PiAPI task_id ${jobId}`
      );
      const response = await axios.get(
        `${this.baseUrl}/task/${jobId}`,
        this.getRequestHeaders()
      );
      const data = response.data.data;
      if (data.status !== "completed" || !data.output?.works?.[0]?.video) {
        throw new MediaError(
          MediaErrorCode.GENERATION_FAILED,
          500,
          `Video not ready or failed. Status: ${data.status}`
        );
      }
      const videoObj = data.output.works[0].video;
      const url = videoObj.resource_without_watermark || videoObj.resource;
      return {
        jobId: jobId,
        video: {
          videoId: videoObj.id || jobId,
          url: url,
          duration: data.input?.duration || 0,
        },
        metadata: {
          prompt: data.input?.prompt,
          imageUrls: data.input?.elements?.map((el: any) => el.image_url),
          duration: data.input?.duration,
        },
      };
    } catch (error) {
      if (error instanceof MediaError) {
        throw error;
      }
      throw new MediaError(
        MediaErrorCode.NETWORK_ERROR,
        500,
        "Network error during video retrieval"
      );
    }
  }
}
