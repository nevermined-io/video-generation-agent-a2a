/**
 * @file errorHandler.ts
 * @description Advanced error handling implementation for A2A protocol
 */

import { Task, TaskState, TaskStatus } from "../interfaces/a2a";
import { TaskStore } from "./taskStore";
import { Logger } from "../utils/logger";
import { Response } from "express";

/**
 * @interface RetryConfig
 * @description Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

/**
 * @interface ErrorHandlerConfig
 * @description Configuration for error handler
 */
export interface ErrorHandlerConfig {
  retry?: RetryConfig;
  timeoutMs?: number;
}

/**
 * @interface A2AError
 * @description Extended Error interface for A2A protocol
 */
export interface A2AError extends Error {
  retryAttempt: number;
  readonly retryable: boolean;
}

/**
 * @class A2AError
 * @description Base error class for A2A protocol
 */
export class A2AError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "A2AError";
  }
}

/**
 * @class TaskTimeoutError
 * @description Error thrown when a task times out
 */
export class TaskTimeoutError extends A2AError {
  constructor(taskId: string) {
    super(`Task ${taskId} timed out`, "TASK_TIMEOUT", true);
    this.name = "TaskTimeoutError";
  }
}

/**
 * @class TaskCancellationError
 * @description Error thrown when a task is cancelled
 */
export class TaskCancellationError extends A2AError {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled`, "TASK_CANCELLED", false);
    this.name = "TaskCancellationError";
  }
}

/**
 * @class ErrorHandler
 * @description Handles errors and retries for A2A tasks
 */
export class ErrorHandler {
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffFactor: 2,
  };

  /**
   * @constructor
   * @param {TaskStore} taskStore - Store for persisting tasks
   * @param {ErrorHandlerConfig} config - Error handler configuration
   */
  constructor(
    private readonly taskStore: TaskStore,
    private readonly config: ErrorHandlerConfig = {}
  ) {}

  /**
   * @method handleError
   * @description Handles an error, logs it, and updates task status
   * @param {A2AError} error - Error to handle
   * @param {string} taskId - ID of the task that failed
   * @returns {Promise<void>}
   */
  public async handleError(error: A2AError, taskId: string): Promise<void> {
    const retryConfig = this.getRetryConfig();
    const metadata = {
      taskId,
      errorType: error.constructor.name,
      errorMessage: error.message,
      retryAttempt: error.retryAttempt,
      maxAttempts: retryConfig.maxAttempts,
    };

    Logger.error(
      `Task ${taskId} failed with error: ${error.message}`,
      metadata
    );

    await this.updateTaskStatus(taskId, "failed", error.message);

    if (error.retryAttempt < retryConfig.maxAttempts) {
      Logger.info(
        `Attempting retry ${error.retryAttempt + 1} of ${
          retryConfig.maxAttempts
        } for task ${taskId}`,
        metadata
      );
      await this.retryTask(taskId, error.retryAttempt + 1);
    } else {
      Logger.warn(
        `Max retry attempts (${retryConfig.maxAttempts}) reached for task ${taskId}`,
        metadata
      );
    }
  }

  /**
   * @method retryTask
   * @description Retries a failed task with exponential backoff
   * @param {string} taskId - ID of the task to retry
   * @param {number} attempt - Current retry attempt number
   * @returns {Promise<void>}
   */
  private async retryTask(taskId: string, attempt: number): Promise<void> {
    const retryConfig = this.getRetryConfig();
    const delay = Math.min(
      retryConfig.initialDelayMs *
        Math.pow(retryConfig.backoffFactor, attempt - 1),
      retryConfig.maxDelayMs
    );

    Logger.debug(
      `Waiting ${delay}ms before retry attempt ${attempt} for task ${taskId}`,
      {
        taskId,
        attempt,
        delay,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.updateTaskStatus(taskId, "retrying");
  }

  /**
   * @method updateTaskStatus
   * @description Updates the status of a task
   * @param {string} taskId - ID of the task to update
   * @param {string} status - New status
   * @param {string} [error] - Optional error message
   * @returns {Promise<void>}
   */
  private async updateTaskStatus(
    taskId: string,
    status: string,
    error?: string
  ): Promise<void> {
    Logger.debug(`Updating task ${taskId} status to ${status}`, {
      taskId,
      status,
      error,
    });

    const task = await this.taskStore.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask: Task = {
      ...task,
      status: {
        state: status as TaskState,
        timestamp: new Date().toISOString(),
        message: error
          ? {
              role: "agent" as const,
              parts: [
                {
                  type: "text" as const,
                  text: error,
                },
              ],
            }
          : undefined,
      },
    };

    await this.taskStore.updateTask(updatedTask);
  }

  /**
   * @method withTimeout
   * @description Wraps a promise with a timeout
   * @param {Promise<T>} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<T>}
   */
  public async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        Logger.warn(`Task timed out after ${timeoutMs}ms`, { timeoutMs });
        reject(
          new TaskTimeoutError(`Operation timed out after ${timeoutMs}ms`)
        );
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * @private
   * @method getRetryConfig
   * @description Gets the retry configuration
   * @returns {RetryConfig}
   */
  private getRetryConfig(): RetryConfig {
    return this.config.retry || this.defaultRetryConfig;
  }

  /**
   * @static
   * @method handleHttpError
   * @description Handles an error in an HTTP response
   * @param {Error} error - Error to handle
   * @param {Response} res - Express response object
   */
  public static handleHttpError(error: Error, res: Response): void {
    Logger.error(`HTTP Error: ${error.message}`);
    if (error instanceof A2AError) {
      res.status(400).json({ error: error.message, code: error.code });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
