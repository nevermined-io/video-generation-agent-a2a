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

/**
 * @class VideoClientDemo
 * @description Demo client for simulating video generation
 */
export class VideoClientDemo {
  private readonly defaultTimeout: number;
  private readonly staticJobId: string = "demo-job-id-123";
  private readonly staticVideoUrl: string =
    "https://www.w3schools.com/html/mov_bbb.mp4";
  private jobStartTimes: Map<string, number> = new Map();
  private jobDurations: Map<string, number> = new Map();

  /**
   * @constructor
   * @param {Object} [config] - Configuration options for the demo client
   * @param {number} [config.timeout] - Default timeout in milliseconds (optional)
   */
  constructor(config: { timeout?: number } = {}) {
    this.defaultTimeout = config.timeout || 15000; // 15 segundos por defecto
  }

  /**
   * @method generateVideo
   * @description Simulates the generation of a new video
   * @param {string} taskId - Our internal task ID
   * @param {string[]} imageUrls - List of image URLs to use as reference (ignored)
   * @param {string} prompt - The text prompt for video generation (ignored)
   * @param {number} [duration=5] - Duration of the video in seconds (simulated)
   * @returns {Promise<GenerateVideoResponse>} Response containing the task ID and initial status
   */
  async generateVideo(
    taskId: string,
    imageUrls: string[],
    prompt: string,
    duration: number = 5
  ): Promise<GenerateVideoResponse> {
    this.jobStartTimes.set(taskId, Date.now());
    this.jobDurations.set(taskId, this.defaultTimeout);
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
   */
  async checkStatus(taskId: string): Promise<StatusResponse> {
    const start = this.jobStartTimes.get(taskId);
    const duration = this.jobDurations.get(taskId) || this.defaultTimeout;
    if (!start) {
      return {
        status: "failed",
        progress: 0,
        data: {
          status: "failed",
          progress: 0,
          jobId: this.staticJobId,
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
          jobId: this.staticJobId,
        },
      };
    } else {
      return {
        status: "completed",
        progress: 100,
        data: {
          status: "completed",
          progress: 100,
          jobId: this.staticJobId,
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
   */
  async *waitForCompletion(
    taskId: string,
    options: WaitForCompletionOptions = {}
  ): AsyncGenerator<StatusData, VideoResponse> {
    const {
      timeout = this.defaultTimeout,
      interval = 2000,
      onStatusUpdate,
    } = options;
    const start = this.jobStartTimes.get(taskId) || Date.now();
    const duration = this.jobDurations.get(taskId) || this.defaultTimeout;
    let elapsed = Date.now() - start;
    while (elapsed < duration) {
      const progress = Math.floor((elapsed / duration) * 100);
      const statusData: StatusData = {
        status: "working",
        progress,
        jobId: this.staticJobId,
      };
      if (onStatusUpdate) onStatusUpdate(statusData);
      yield statusData;
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed = Date.now() - start;
    }
    const statusData: StatusData = {
      status: "completed",
      progress: 100,
      jobId: this.staticJobId,
    };
    if (onStatusUpdate) onStatusUpdate(statusData);
    yield statusData;
    return await this.getVideo(taskId);
  }

  /**
   * @method getVideo
   * @description Simulates retrieving the generated video data once complete
   * @param {string} taskId - Our internal task ID
   * @returns {Promise<VideoResponse>} Generated video data including download URL
   */
  async getVideo(taskId: string): Promise<VideoResponse> {
    return {
      jobId: this.staticJobId,
      video: {
        videoId: this.staticJobId,
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
