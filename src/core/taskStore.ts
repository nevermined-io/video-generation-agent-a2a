/**
 * @file taskStore.ts
 * @description Storage management for tasks
 */

import { Task } from "../interfaces/a2a";
import { Logger } from "../utils/logger";

/**
 * @typedef {Function} StatusListener
 * @description Function type for task status update listeners
 */
type StatusListener = (task: Task) => Promise<void>;

/**
 * @class TaskStore
 * @description Manages task storage and retrieval
 */
export class TaskStore {
  private tasks: Map<string, Task> = new Map();
  private statusListeners: Set<StatusListener> = new Set();

  /**
   * @method addStatusListener
   * @description Add a listener for task status updates
   */
  public addStatusListener(listener: StatusListener): void {
    this.statusListeners.add(listener);
    Logger.debug("Added new status listener");
  }

  /**
   * @method removeStatusListener
   * @description Remove a task status update listener
   */
  public removeStatusListener(listener: StatusListener): void {
    this.statusListeners.delete(listener);
    Logger.debug("Removed status listener");
  }

  /**
   * @method notifyStatusListeners
   * @description Notify all listeners about a task update
   */
  private async notifyStatusListeners(task: Task): Promise<void> {
    try {
      const listeners = Array.from(this.statusListeners);
      await Promise.all(listeners.map((listener) => listener(task)));
    } catch (error) {
      Logger.error(
        `Error notifying status listeners: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * @method createTask
   * @description Create a new task in the store
   */
  public async createTask(task: Task): Promise<Task> {
    try {
      if (!task?.id) {
        throw new Error("Invalid task: missing task ID");
      }

      if (this.tasks.has(task.id)) {
        throw new Error(`Task with ID ${task.id} already exists`);
      }

      this.tasks.set(task.id, task);
      Logger.info(`Created task ${task.id} in store`);
      await this.notifyStatusListeners(task);
      return task;
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
   * @description Retrieve a task by ID
   */
  public async getTask(taskId: string): Promise<Task | null> {
    try {
      const task = this.tasks.get(taskId);
      return task || null;
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
   * @method updateTask
   * @description Update an existing task
   */
  public async updateTask(task: Task): Promise<Task> {
    try {
      if (!task?.id) {
        throw new Error("Invalid task: missing task ID");
      }

      if (!this.tasks.has(task.id)) {
        throw new Error(`Task ${task.id} not found`);
      }

      this.tasks.set(task.id, task);
      Logger.info(`Updated task ${task.id}`);
      await this.notifyStatusListeners(task);
      return task;
    } catch (error) {
      Logger.error(
        `Error updating task: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * @method deleteTask
   * @description Delete a task from the store
   */
  public async deleteTask(taskId: string): Promise<boolean> {
    try {
      const deleted = this.tasks.delete(taskId);
      if (deleted) {
        Logger.info(`Deleted task ${taskId}`);
      } else {
        Logger.warn(`Task ${taskId} not found for deletion`);
      }
      return deleted;
    } catch (error) {
      Logger.error(
        `Error deleting task ${taskId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }

  /**
   * @method listTasks
   * @description Get all tasks in the store
   */
  public async listTasks(): Promise<Task[]> {
    try {
      return Array.from(this.tasks.values());
    } catch (error) {
      Logger.error(
        `Error listing tasks: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    }
  }
}
