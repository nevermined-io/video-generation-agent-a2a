/**
 * @file videoController.ts
 * @description A2A controller for video generation process
 */

import {
  TaskContext,
  TaskState,
  TaskYieldUpdate,
  TaskArtifact,
  TaskStatus,
  Task,
} from "../interfaces/a2a";
import { getVideoClient } from "../services/videoClientService";
import { Logger } from "../utils/logger";

/**
 * @class VideoGenerationController
 * @description Controls the video generation process following A2A protocol
 */
export class VideoGenerationController {
  private readonly videoClient: ReturnType<typeof getVideoClient>;

  /**
   * @constructor
   * @param {string} apiKey - API key for PiAPI video generation
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("PiAPI API key is required");
    }
    this.videoClient = getVideoClient({ apiKey });
  }

  /**
   * @private
   * @method updateTaskHistory
   * @description Updates the task history with a new status
   * @param {Task} task - The task to update
   * @param {TaskYieldUpdate} update - The update to add to history
   */
  private updateTaskHistory(task: Task, update: TaskYieldUpdate): void {
    if (!task.history) {
      task.history = [];
    }
    const historyEntry: TaskStatus = {
      state: update.state,
      timestamp: new Date().toISOString(),
      message: update.message,
    };
    task.history.push(historyEntry);
    task.status = historyEntry;
  }

  /**
   * @private
   * @method createTextMessage
   * @description Creates a text message part for A2A updates
   */
  private createTextMessage(text: string): TaskYieldUpdate {
    return {
      state: TaskState.WORKING,
      message: {
        role: "agent",
        parts: [{ type: "text", text }],
      },
    };
  }

  /**
   * @private
   * @method createArtifact
   * @description Creates a task artifact from video data
   */
  private createArtifact(videoUrl: string): TaskArtifact {
    return {
      parts: [
        {
          type: "video",
          url: videoUrl,
        },
      ],
      metadata: {
        url: videoUrl,
      },
      index: 0,
    };
  }

  /**
   * @private
   * @method validatePrompt
   * @description Validates the prompt and requests additional information if needed
   * @param {string} prompt - The prompt to validate
   * @returns {TaskYieldUpdate | null} Update requesting more info if needed, null if valid
   */
  private validatePrompt(prompt: string): TaskYieldUpdate | null {
    if (!prompt || !prompt.trim()) {
      return {
        state: TaskState.INPUT_REQUIRED,
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: "Please provide a prompt for the video. No prompt was provided.",
            },
          ],
        },
      };
    }
    if (prompt.trim().length < 5) {
      return {
        state: TaskState.INPUT_REQUIRED,
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: "Please provide a more detailed description for the video. The current prompt is too short.",
            },
          ],
        },
      };
    }
    return null;
  }

  /**
   * @async
   * @generator
   * @function handleTask
   * @description Handles a video generation task according to A2A protocol (active polling)
   * @param {TaskContext} context - Task context from A2A
   * @yields {TaskYieldUpdate} Status updates and artifacts
   */
  async *handleTask(context: TaskContext): AsyncGenerator<TaskYieldUpdate> {
    const { task, isCancelled } = context;
    try {
      const prompt =
        task.message?.parts.find((p) => p.type === "text")?.text || "";
      // Validate prompt
      const validationUpdate = this.validatePrompt(prompt);
      if (validationUpdate) {
        this.updateTaskHistory(task, validationUpdate);
        yield validationUpdate;
        return;
      }
      // Initial state
      const initialUpdate = this.createTextMessage(
        "Starting video generation process..."
      );
      this.updateTaskHistory(task, initialUpdate);
      yield initialUpdate;
      // Launch generation
      const imageUrls = Array.isArray(task.metadata?.imageUrls)
        ? task.metadata.imageUrls
        : [];
      const duration =
        typeof task.metadata?.duration === "number"
          ? task.metadata.duration
          : undefined;
      await this.videoClient.generateVideo(
        task.id,
        imageUrls,
        prompt,
        duration
      );
      // Polling of status and wait
      let lastProgress = 0;
      try {
        for await (const status of this.videoClient.waitForCompletion(task.id, {
          interval: 5000,
        })) {
          if (isCancelled()) {
            const cancelUpdate: TaskYieldUpdate = {
              state: TaskState.CANCELLED,
              message: {
                role: "agent",
                parts: [{ type: "text", text: "Task cancelled by user" }],
              },
            };
            this.updateTaskHistory(task, cancelUpdate);
            yield cancelUpdate;
            return;
          }
          if (status.progress > lastProgress) {
            lastProgress = status.progress;
            const progressUpdate = this.createTextMessage(
              `Video generation progress: ${status.progress}%`
            );
            this.updateTaskHistory(task, progressUpdate);
            yield progressUpdate;
          }
        }
        // Get the final video data
        const videoData = await this.videoClient.getVideo(task.id);
        const artifact: TaskArtifact = this.createArtifact(videoData.video.url);
        const finalUpdate: TaskYieldUpdate = {
          state: TaskState.COMPLETED,
          message: {
            role: "agent",
            parts: [
              {
                type: "text",
                text: "Video generation completed successfully.",
              },
            ],
          },
          artifacts: [artifact],
        };
        this.updateTaskHistory(task, finalUpdate);
        yield finalUpdate;
      } catch (error) {
        Logger.error(`VideoGenerationController error: ${error}`);
        const failUpdate: TaskYieldUpdate = {
          state: TaskState.FAILED,
          message: {
            role: "agent",
            parts: [
              {
                type: "text",
                text: `Video generation failed: ${error}`,
              },
            ],
          },
        };
        this.updateTaskHistory(task, failUpdate);
        yield failUpdate;
      }
    } catch (error) {
      Logger.error(`VideoGenerationController error: ${error}`);
      const failUpdate: TaskYieldUpdate = {
        state: TaskState.FAILED,
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: `Video generation failed: ${error}`,
            },
          ],
        },
      };
      this.updateTaskHistory(task, failUpdate);
      yield failUpdate;
    }
  }
}
