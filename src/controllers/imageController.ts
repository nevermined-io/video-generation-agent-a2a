/**
 * @file imageController.ts
 * @description A2A controller for image generation process
 */

import {
  TaskContext,
  TaskState,
  TaskYieldUpdate,
  TaskArtifact,
  TaskStatus,
  Task,
} from "../interfaces/a2a";
import { ImageClient } from "../clients/imageClient";
import { Logger } from "../utils/logger";

/**
 * @class ImageGenerationController
 * @description Controls the image generation process following A2A protocol
 */
export class ImageGenerationController {
  private readonly imageClient: ImageClient;

  /**
   * @constructor
   * @param {string} apiKey - API key for Fal.ai image generation
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Fal.ai API key is required");
    }
    this.imageClient = new ImageClient({ apiKey });
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
   * @description Creates a task artifact from image data
   */
  private createArtifact(imageUrl: string): TaskArtifact {
    return {
      parts: [
        {
          type: "image",
          url: imageUrl,
        },
      ],
      metadata: {
        url: imageUrl,
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
              text: "Please provide a prompt for the image. No prompt was provided.",
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
              text: "Please provide a more detailed description for the image. The current prompt is too short.",
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
   * @description Handles an image generation task according to A2A protocol
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
        "Starting image generation process..."
      );
      this.updateTaskHistory(task, initialUpdate);
      yield initialUpdate;
      // Launch generation
      const genUpdate = this.createTextMessage(
        "Generating image, please wait..."
      );
      this.updateTaskHistory(task, genUpdate);
      yield genUpdate;
      // Start generation
      const response = await this.imageClient.generateImage(task.id, prompt);
      // Emit final artifact directly
      const artifact: TaskArtifact = this.createArtifact(response.image.url);
      const finalUpdate: TaskYieldUpdate = {
        state: TaskState.COMPLETED,
        message: {
          role: "agent",
          parts: [
            { type: "text", text: "Image generation completed successfully." },
          ],
        },
        artifacts: [artifact],
      };
      this.updateTaskHistory(task, finalUpdate);
      yield finalUpdate;
    } catch (error) {
      Logger.error(`ImageGenerationController error: ${error}`);
      const failUpdate: TaskYieldUpdate = {
        state: TaskState.FAILED,
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: `Image generation failed: ${error}`,
            },
          ],
        },
      };
      this.updateTaskHistory(task, failUpdate);
      yield failUpdate;
    }
  }
}
