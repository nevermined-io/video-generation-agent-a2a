/**
 * @file taskProcessor.ts
 * @description Processes tasks and manages their lifecycle
 */

import {
  Task,
  TaskState,
  Message,
  MessagePart,
  TaskContext,
} from "../interfaces/a2a";
import { TaskStore } from "./taskStore";
import { Logger } from "../utils/logger";
import { ImageGenerationController } from "../controllers/imageController";
import { VideoGenerationController } from "../controllers/videoController";

/**
 * @class TaskProcessor
 * @description Handles the processing of individual tasks
 */
export class TaskProcessor {
  private isCancelled: boolean = false;

  /**
   * @constructor
   * @param {TaskStore} taskStore - Store for task persistence
   * @param {ImageGenerationController} imageController - Controller for image generation
   * @param {VideoGenerationController} videoController - Controller for video generation
   */
  constructor(
    private taskStore: TaskStore,
    private imageController: ImageGenerationController,
    private videoController: VideoGenerationController
  ) {}

  /**
   * @method processTask
   * @description Process a single task
   */
  public async processTask(task: Task): Promise<void> {
    try {
      Logger.info(`Processing task ${task.id}`);

      // Validate task data
      this.validateTask(task);

      // Update task status to working
      await this.updateTaskStatus(task, TaskState.WORKING);

      // Create task context
      const context: TaskContext = {
        task,
        isCancelled: () => this.isCancelled,
      };

      // Route to the correct controller based on taskType
      let controller;
      if (task.taskType === "text2image" || task.taskType === "image2image") {
        controller = this.imageController;
      } else if (task.taskType === "text2video") {
        controller = this.videoController;
      } else {
        throw new Error(
          "Invalid or missing taskType. Must be one of: text2image, image2image, text2video."
        );
      }
      for await (const update of controller.handleTask(context)) {
        await this.updateTaskStatus(
          task,
          update.state,
          update.message,
          update.artifacts
        );
        if (
          update.state === TaskState.COMPLETED ||
          update.state === TaskState.FAILED
        ) {
          break;
        }
      }
    } catch (error) {
      Logger.error(
        `Error processing task ${task.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      const errorMessage: Message = {
        role: "agent",
        parts: [
          {
            type: "text",
            text:
              error instanceof Error
                ? error.message
                : "Unknown error occurred during processing",
          },
        ],
      };

      await this.updateTaskStatus(task, TaskState.FAILED, errorMessage);
      throw error;
    }
  }

  /**
   * @method validateTask
   * @description Validate task data before processing
   */
  private validateTask(task: Task): void {
    if (!task?.message?.parts) {
      throw new Error("Task message is empty or invalid");
    }

    const textParts = task.message.parts.filter(
      (part): part is MessagePart & { text: string } =>
        part.type === "text" &&
        typeof part.text === "string" &&
        part.text.trim().length > 0
    );

    if (textParts.length === 0) {
      throw new Error("Task must contain a non-empty text prompt");
    }
  }

  /**
   * @method updateTaskStatus
   * @description Update task status and persist changes
   */
  private async updateTaskStatus(
    task: Task,
    state: TaskState,
    message?: Message,
    artifacts?: any[]
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const currentTask = await this.taskStore.getTask(task.id);

      if (!currentTask) {
        throw new Error(`Task ${task.id} not found`);
      }

      // If the state doesn't change, don't update or notify
      if (currentTask.status?.state === state) {
        return;
      }

      const statusUpdate = {
        state,
        timestamp,
        message,
        artifacts,
      };

      const updatedTask = {
        ...currentTask,
        status: statusUpdate,
        history: [...(currentTask.history || []), statusUpdate],
      };

      await this.taskStore.updateTask(updatedTask);
      Logger.info(`Updated task ${task.id} status to ${state}`);
    } catch (error) {
      Logger.error(
        `Error updating task status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * @method cancelTask
   * @description Cancel the current task processing
   */
  public cancelTask(): void {
    this.isCancelled = true;
  }
}
