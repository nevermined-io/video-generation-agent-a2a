/**
 * @file task.ts
 * @description Type definitions for task-related entities
 */

/**
 * @enum TaskState
 * @description Possible states of a task
 */
export enum TaskState {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * @interface Task
 * @description Represents a task in the system
 */
export interface Task {
  /**
   * @property {string} id - Unique identifier for the task
   */
  id: string;

  /**
   * @property {TaskState} state - Current state of the task
   */
  state: TaskState;

  /**
   * @property {Date} createdAt - When the task was created
   */
  createdAt: Date;

  /**
   * @property {Date} [updatedAt] - When the task was last updated
   */
  updatedAt?: Date;

  /**
   * @property {any} [result] - The result of the task if completed
   */
  result?: any;

  /**
   * @property {string} [error] - Error message if the task failed
   */
  error?: string;
}
