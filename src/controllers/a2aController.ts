/**
 * @file a2aController.ts
 * @description Controller for handling A2A (Agent-to-Agent) interactions
 */

import { Request, Response } from "express";
import { Task, TaskState, Message, TaskStatus } from "../interfaces/a2a";
import { TaskStore } from "../core/taskStore";
import { SessionManager } from "../core/sessionManager";
import { ErrorHandler } from "../core/errorHandler";
import { TaskProcessor } from "../core/taskProcessor";
import { TaskQueue } from "../core/taskQueue";
import { Logger } from "../utils/logger";
import { PushNotificationService } from "../services/pushNotificationService";
import { StreamingService } from "../services/streamingService";
import {
  PushNotificationConfig,
  PushNotificationEvent,
  PushNotificationEventType,
} from "../interfaces/a2a";
import { ImageGenerationController } from "./imageController";
import { VideoGenerationController } from "./videoController";

/**
 * @interface A2AControllerConfig
 * @description Configuration options for the A2A controller
 */
interface A2AControllerConfig {
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelay?: number;
  falKey?: string;
  piapiKey?: string;
}

/**
 * @interface QueueStatus
 * @description Status information about the task queue
 */
export interface QueueStatus {
  queuedTasks: number;
  processingTasks: number;
  failedTasks: number;
  completedTasks: number;
}

/**
 * @class A2AController
 * @description Controls and manages A2A interactions and task processing
 */
export class A2AController {
  private taskStore: TaskStore;
  private sessionManager: SessionManager;
  private taskProcessor: TaskProcessor;
  private taskQueue: TaskQueue;
  private pushNotificationService: PushNotificationService;
  private streamingService: StreamingService;

  /**
   * @constructor
   * @param {A2AControllerConfig} config - Configuration options
   * @param {TaskStore} taskStore - Optional task store instance
   * @param {SessionManager} sessionManager - Optional session manager instance
   * @param {TaskProcessor} taskProcessor - Optional task processor instance
   * @param {TaskQueue} taskQueue - Optional task queue instance
   */
  constructor(
    private config: A2AControllerConfig = {},
    taskStore?: TaskStore,
    sessionManager?: SessionManager,
    taskProcessor?: TaskProcessor,
    taskQueue?: TaskQueue
  ) {
    if (!config.falKey || !config.piapiKey) {
      throw new Error("Fal.ai and PiAPI API keys are required");
    }

    this.taskStore = taskStore || new TaskStore();
    this.sessionManager = sessionManager || new SessionManager();
    const imageController = new ImageGenerationController(config.falKey);
    const videoController = new VideoGenerationController(config.piapiKey);
    this.taskProcessor =
      taskProcessor ||
      new TaskProcessor(this.taskStore, imageController, videoController);
    this.taskQueue =
      taskQueue ||
      new TaskQueue(this.taskProcessor, {
        maxConcurrent: config.maxConcurrent || 1,
        maxRetries: config.maxRetries || 3,
        retryDelay: config.retryDelay || 1000,
      });
    this.pushNotificationService = new PushNotificationService();
    this.streamingService = new StreamingService();

    // Set up task store listeners for notifications
    this.setupTaskStoreListeners();
  }

  /**
   * @private
   * @method setupTaskStoreListeners
   * @description Set up listeners for task store events to trigger notifications
   */
  private setupTaskStoreListeners(): void {
    this.taskStore.addStatusListener(async (task: Task) => {
      // Handle push notifications
      const event: PushNotificationEvent = {
        type: PushNotificationEventType.STATUS_UPDATE,
        taskId: task.id,
        timestamp: new Date().toISOString(),
        data: {
          status: task.status,
          artifacts: task.artifacts,
        },
      };

      this.pushNotificationService.notify(task.id, event);

      // Handle streaming updates
      this.streamingService.notifyTaskUpdate(task);

      // Send completion event if task is in final state
      if (
        task.status.state === TaskState.COMPLETED ||
        task.status.state === TaskState.CANCELLED ||
        task.status.state === TaskState.FAILED
      ) {
        const completionEvent: PushNotificationEvent = {
          type: PushNotificationEventType.COMPLETION,
          taskId: task.id,
          timestamp: new Date().toISOString(),
          data: {
            finalStatus: task.status,
            artifacts: task.artifacts,
          },
        };
        this.pushNotificationService.notify(task.id, completionEvent);
      }
    });
  }

  /**
   * @method healthCheck
   * @description Check service health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    res.json({ status: "healthy" });
  };

  /**
   * @method getAgentCard
   * @description Returns the agent's capabilities and metadata
   * @returns {Object} Agent card information
   */
  public getAgentCard = async (req: Request, res: Response): Promise<void> => {
    res.json({
      name: "Image & Video Generation Agent",
      description:
        "AI agent that generates images and videos from text prompts, using advanced AI models. Supports real-time updates (streaming) and push notifications.",
      url: "http://localhost:8000",
      provider: {
        organization: "Nevermined",
        url: "https://nevermined.io",
      },
      version: "2.0.0",
      documentationUrl:
        "https://docs.nevermined.io/agents/image-video-generation",
      capabilities: {
        streaming: true,
        pushNotifications: true,
        stateTransitionHistory: true,
      },
      defaultInputModes: ["text/plain", "application/json"],
      defaultOutputModes: [
        "application/json",
        "image/png",
        "video/mp4",
        "text/plain",
      ],
      notificationEvents: [
        {
          type: "status_update",
          description:
            "Task status update. Includes { status: TaskStatus, artifacts: TaskArtifact[] }",
        },
        {
          type: "completion",
          description:
            "Task completed/cancelled/failed. Includes { finalStatus: TaskStatus, artifacts: TaskArtifact[] }",
        },
        {
          type: "artifact_created",
          description:
            "(Planned) New artifact created. Includes { artifact: TaskArtifact }",
        },
        {
          type: "error",
          description: "Error event. Includes { error: string }",
        },
      ],
      skills: [
        {
          id: "image-generation",
          name: "Image Generation",
          description: "Generates an image from a text prompt.",
          tags: ["image", "generation", "ai"],
          inputModes: ["text/plain", "application/json"],
          outputModes: ["image/png", "application/json"],
          parameters: [
            {
              name: "taskType",
              description:
                "Type of image generation task. Must be 'text2image' (required)",
              required: true,
              type: "string",
              enum: ["text2image"],
            },
            {
              name: "prompt",
              description: "Text prompt for image generation",
              required: true,
              type: "string",
            },
          ],
        },
        {
          id: "video-generation",
          name: "Video Generation",
          description:
            "Generates a video from a text prompt and one or more reference images",
          tags: ["video", "generation", "ai"],
          inputModes: ["text/plain", "application/json"],
          outputModes: ["video/mp4", "application/json"],
          parameters: [
            {
              name: "taskType",
              description:
                "Type of video generation task. Must be 'text2video' (required)",
              required: true,
              type: "string",
              enum: ["text2video"],
            },
            {
              name: "prompt",
              description: "Text prompt for video generation",
              required: true,
              type: "string",
            },
            {
              name: "imageUrls",
              description: "List of reference image URLs",
              required: true,
              type: "string[]",
            },
            {
              name: "duration",
              description: "Video duration in seconds (5 or 10)",
              required: false,
              type: "number",
            },
          ],
        },
      ],
    });
  };

  /**
   * @method sendTask
   * @description Create and send a new task
   */
  public sendTask = async (req: Request, res: Response): Promise<void> => {
    try {
      Logger.info(`Sending task: ${req.body.prompt}`);
      const task = await this.createTask(req.body);
      res.json(task);
    } catch (error) {
      if (error instanceof Error) {
        Logger.error(`Error sending task: ${error.message}`);
      }
      ErrorHandler.handleHttpError(error as Error, res);
    }
  };

  /**
   * @method getTaskStatus
   * @description Get status of a specific task
   */
  public getTaskStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      Logger.info(`Getting status for task: ${req.params.taskId}`);
      const task = await this.getTask(req.params.taskId);

      if (!task) {
        Logger.warn(`Task ${req.params.taskId} not found`);
        res.status(404).json({ error: "Task not found" });
        return;
      }

      Logger.debug(`Task ${req.params.taskId} status:`, task);
      res.json(task);
    } catch (error) {
      Logger.error(
        `Error getting task status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      ErrorHandler.handleHttpError(error as Error, res);
    }
  };

  /**
   * @method cancelTask
   * @description Cancel a task if possible
   */
  public async cancelTask(taskId: string): Promise<boolean> {
    try {
      const task = await this.taskStore.getTask(taskId);
      if (!task) {
        Logger.warn(`Task ${taskId} not found for cancellation`);
        return false;
      }

      const cancelled = this.taskQueue.cancelTask(taskId);
      if (cancelled && task) {
        const updatedTask = {
          ...task,
          status: {
            ...task.status,
            state: TaskState.CANCELLED,
            timestamp: new Date().toISOString(),
          },
        };
        await this.taskStore.updateTask(updatedTask);
        Logger.info(`Task ${taskId} cancelled successfully`);
      }

      return cancelled;
    } catch (error) {
      Logger.error(
        `Error cancelling task ${taskId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    }
  }

  /**
   * @method createTask
   * @description Create and enqueue a new task
   */
  public async createTask(params: {
    prompt: string;
    sessionId?: string;
    taskType?: string;
    [key: string]: any;
  }): Promise<Task> {
    try {
      // Create initial message
      const message: Message = {
        role: "user",
        parts: [{ type: "text", text: params.prompt }],
      };

      // Create new task
      const task: Task = {
        id: crypto.randomUUID(),
        prompt: params.prompt,
        status: {
          state: TaskState.SUBMITTED,
          timestamp: new Date().toISOString(),
        },
        message,
        sessionId: params.sessionId,
        taskType: params.taskType,
        // Propaga cualquier otro campo relevante, pero omite los ya definidos
        ...Object.fromEntries(
          Object.entries(params).filter(
            ([k]) => !["prompt", "sessionId", "taskType"].includes(k)
          )
        ),
      };

      // Store task first
      const storedTask = await this.taskStore.createTask({ ...task });
      Logger.info(`Created task ${storedTask.id}`);

      // Then enqueue it
      await this.taskQueue.enqueueTask({ ...storedTask });
      Logger.info(`Enqueued task ${storedTask.id}`);

      return storedTask;
    } catch (error) {
      Logger.error(
        `Error creating task: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * @method getTask
   * @description Get task by ID
   */
  public async getTask(taskId: string): Promise<Task | null> {
    try {
      const task = await this.taskStore.getTask(taskId);
      return task;
    } catch (error) {
      Logger.error(
        `Error getting task ${taskId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * @method updateTaskStatus
   * @description Update task status and history
   */
  public async updateTaskStatus(
    taskId: string,
    state: TaskState,
    message?: Message
  ): Promise<Task | null> {
    try {
      const task = await this.taskStore.getTask(taskId);
      if (!task) {
        Logger.warn(`Task ${taskId} not found for status update`);
        return null;
      }

      const newStatus: TaskStatus = {
        state,
        timestamp: new Date().toISOString(),
        message,
      };

      // Ensure we have a history array and add current status if it exists
      const history = [...(task.history || [])];
      if (task.status) {
        history.push(task.status);
      }

      const updatedTask: Task = {
        ...task,
        status: newStatus,
        history,
      };

      const result = await this.taskStore.updateTask(updatedTask);
      Logger.info(`Updated task ${taskId} status to ${state}`);
      return result;
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
   * @method listTasks
   * @description List all tasks, optionally filtered by session ID
   */
  public listTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const sessionId = req.query.session_id as string;
      const tasks = await this.taskStore.listTasks();
      const filteredTasks = sessionId
        ? tasks.filter((task) => task.sessionId === sessionId)
        : tasks;
      res.json(filteredTasks);
    } catch (error) {
      Logger.error(
        `Error listing tasks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      ErrorHandler.handleHttpError(error as Error, res);
    }
  };

  /**
   * @method sendTaskSubscribe
   * @description Create and send a new task with subscription for real-time updates
   */
  public sendTaskSubscribe = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Create and store the task
      const task = await this.createTask(req.body);

      // Send the task response immediately
      res.json(task);

      // Enqueue the task for processing
      await this.taskQueue.enqueueTask(task);
    } catch (error) {
      Logger.error(
        `Error in sendTaskSubscribe: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      ErrorHandler.handleHttpError(error as Error, res);
    }
  };

  /**
   * @method getTaskHistory
   * @description Get history of a specific task
   */
  public getTaskHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const task = await this.getTask(req.params.taskId);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(task.history || []);
    } catch (error) {
      ErrorHandler.handleHttpError(error as Error, res);
    }
  };

  /**
   * @method subscribeSSE
   * @description Subscribe a client to SSE notifications for a task
   */
  public subscribeSSE = async (req: Request, res: Response): Promise<void> => {
    try {
      const taskId = req.params.taskId;
      const config: PushNotificationConfig = {
        taskId,
        eventTypes: req.query.eventTypes
          ? ((req.query.eventTypes as string)
              .split(",")
              .map((type) => type.toLowerCase())
              .map((type) => {
                switch (type) {
                  case "status_update":
                    return PushNotificationEventType.STATUS_UPDATE;
                  case "artifact_created":
                    return PushNotificationEventType.ARTIFACT_CREATED;
                  case "error":
                    return PushNotificationEventType.ERROR;
                  case "completion":
                    return PushNotificationEventType.COMPLETION;
                  default:
                    return undefined;
                }
              })
              .filter((t) => t !== undefined) as PushNotificationEventType[])
          : [],
      };
      const task = await this.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      this.pushNotificationService.subscribeSSE(taskId, res, config);
    } catch (error) {
      Logger.error(
        `Error setting up SSE subscription: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      if (!res.headersSent) {
        ErrorHandler.handleHttpError(error as Error, res);
      }
    }
  };

  /**
   * @method subscribeWebhook
   * @description Register a webhook for push notifications for a task
   */
  public subscribeWebhook = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const taskId = req.params.taskId;
      const config: PushNotificationConfig = req.body;
      const task = await this.getTask(taskId);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      await this.pushNotificationService.subscribeWebhook(taskId, config);
      res.json({
        success: true,
        message: "Push notification webhook configured",
      });
    } catch (error) {
      Logger.error(
        `Error setting up webhook: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      if (!res.headersSent) {
        ErrorHandler.handleHttpError(error as Error, res);
      }
    }
  };

  /**
   * @method getQueueStatus
   * @description Get current queue status
   */
  public getQueueStatus(): QueueStatus {
    return this.taskQueue.getQueueStatus();
  }
}

// Export only the class
export default A2AController;
