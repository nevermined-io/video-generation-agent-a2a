/**
 * @file videoClientDemo.ts
 * @description Demo implementation of a video generation client that simulates PiAPI responses
 */

import {
  GenerateVideoResponse,
  StatusResponse,
  VideoResponse,
  WaitForCompletionOptions,
  StatusData,
} from "../interfaces/apiResponses";
import { MediaError, MediaErrorCode } from "../errors/mediaError";
import { Logger } from "../utils/logger";

/**
 * @class VideoClient
 * @description Demo client for simulating video generation
 */
export class VideoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTimeout: number;
  private readonly staticJobId: string = "demo-job-id-123";
  private readonly staticVideoUrl: string =
    "https://www.w3schools.com/html/mov_bbb.mp4";
  private jobStartTimes: Map<string, number> = new Map();
  private jobDurations: Map<string, number> = new Map();
  private jobIdMap: Map<string, string> = new Map(); // Maps taskId to PiAPI task_id

  /**
   * @constructor
   * @param {Object} config - Configuration options for the demo client
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
    this.baseUrl = config.baseUrl || "https://demo-api.example.com/api/v1";
    this.defaultTimeout = config.timeout || 15000; // 15 segundos por defecto
  }

  /**
   * @private
   * @method getRequestHeaders
   * @description Returns the necessary headers for API requests (demo implementation)
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
    const jobId = this.jobIdMap.get(taskId) || this.staticJobId;
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
   * @description Simulates the generation of a new video
   * @param {string} taskId - Our internal task ID
   * @param {string[]} imageUrls - List of image URLs to use as reference
   * @param {string} prompt - The text prompt for video generation
   * @param {number} [duration=5] - Duration of the video in seconds (simulated)
   * @returns {Promise<GenerateVideoResponse>} Response containing the task ID and initial status
   * @throws {MediaError} If the input parameters are invalid
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

    this.jobStartTimes.set(taskId, Date.now());
    this.jobDurations.set(taskId, this.defaultTimeout);
    this.jobIdMap.set(taskId, `demo-job-${Date.now()}`);

    const jobId = this.getJobId(taskId);
    Logger.debug(`Mapped taskId ${taskId} to demo task_id ${jobId}`);

    return {
      id: taskId,
      status: "working",
      estimatedTime: Math.ceil(this.defaultTimeout / 1000),
    };
  }

  /**
   * @method checkStatus
   * @description Simulates checking the status of a video generation task
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<StatusResponse>} Current status of the generation task
   * @throws {MediaError} If the task ID is invalid
   */
  async checkStatus(taskId: string): Promise<StatusResponse> {
    if (!taskId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Task ID is required"
      );
    }

    const start = this.jobStartTimes.get(taskId);
    const duration = this.jobDurations.get(taskId) || this.defaultTimeout;
    const jobId = this.getJobId(taskId);

    Logger.debug(
      `Checking status for taskId ${taskId} with demo task_id ${jobId}`
    );

    if (!start) {
      return {
        status: "failed",
        progress: 0,
        data: {
          status: "failed",
          progress: 0,
          jobId: jobId,
          error: "Task not found",
        },
      };
    }

    const elapsed = Date.now() - start;
    if (elapsed < duration) {
      const progress = Math.floor((elapsed / duration) * 100);
      return {
        status: "working",
        progress,
        data: {
          status: "working",
          progress,
          jobId: jobId,
        },
      };
    } else {
      return {
        status: "completed",
        progress: 100,
        data: {
          status: "completed",
          progress: 100,
          jobId: jobId,
        },
      };
    }
  }

  /**
   * @method waitForCompletion
   * @description Simulates waiting for a video generation task to complete
   * @param {string} taskId - Our internal task ID
   * @param {Object} [options] - Options for the wait operation
   * @returns {AsyncGenerator<StatusData, VideoResponse>} Generator that yields status updates and returns video data
   * @throws {MediaError} If the wait operation times out or fails
   */
  async *waitForCompletion(
    taskId: string,
    options: WaitForCompletionOptions = {}
  ): AsyncGenerator<StatusData, VideoResponse> {
    if (!taskId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Task ID is required"
      );
    }

    const {
      timeout = this.defaultTimeout,
      interval = 2000,
      onStatusUpdate,
    } = options;

    const start = this.jobStartTimes.get(taskId) || Date.now();
    const duration = this.jobDurations.get(taskId) || this.defaultTimeout;
    const jobId = this.getJobId(taskId);

    Logger.debug(
      `Waiting for completion of taskId ${taskId} with demo task_id ${jobId}`
    );

    let elapsed = Date.now() - start;
    const startTime = Date.now();

    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new MediaError(
          MediaErrorCode.TIMEOUT,
          408,
          `Video generation timed out after ${timeout}ms`
        );
      }

      elapsed = Date.now() - start;

      if (elapsed < duration) {
        const progress = Math.floor((elapsed / duration) * 100);
        const statusData: StatusData = {
          status: "working",
          progress,
          jobId: jobId,
        };
        if (onStatusUpdate) onStatusUpdate(statusData);
        yield statusData;
        await new Promise((resolve) => setTimeout(resolve, interval));
      } else {
        const statusData: StatusData = {
          status: "completed",
          progress: 100,
          jobId: jobId,
        };
        if (onStatusUpdate) onStatusUpdate(statusData);
        yield statusData;
        return await this.getVideo(taskId);
      }
    }
  }

  /**
   * @method getVideo
   * @description Simulates retrieving the generated video data once complete
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<VideoResponse>} Generated video data including download URL
   * @throws {MediaError} If the task ID is invalid
   */
  async getVideo(taskId: string): Promise<VideoResponse> {
    if (!taskId) {
      throw new MediaError(
        MediaErrorCode.INVALID_REQUEST,
        400,
        "Task ID is required"
      );
    }

    const jobId = this.getJobId(taskId);
    Logger.debug(
      `Getting video for taskId ${taskId} with demo task_id ${jobId}`
    );

    return {
      jobId: jobId,
      video: {
        videoId: jobId,
        url: this.staticVideoUrl,
        duration: 10,
      },
      metadata: {
        prompt: "Demo video generation",
        imageUrls: [],
        duration: 10,
      },
    };
  }
}
