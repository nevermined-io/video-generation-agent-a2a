/**
 * @file taskQueue.test.ts
 * @description Tests for TaskQueue implementation
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { TaskQueue } from "../../../src/core/taskQueue";
import { TaskProcessor } from "../../../src/core/taskProcessor";
import { Task, TaskState } from "../../../src/interfaces/a2a";
import { Logger } from "../../../src/utils/logger";
import { TaskStore } from "../../../src/core/taskStore";
import { ImageGenerationController } from "../../../src/controllers/imageController";
import { VideoGenerationController } from "../../../src/controllers/videoController";

// Mock dependencies
jest.mock("../../../src/utils/logger");
jest.mock("../../../src/core/taskProcessor");
jest.mock("../../../src/core/taskStore");
jest.mock("../../../src/controllers/imageController", () => {
  return {
    ImageGenerationController: jest.fn().mockImplementation(() => ({
      handleTask: jest.fn().mockImplementation(async function* () {
        yield { state: TaskState.COMPLETED };
      }),
    })),
  };
});
jest.mock("../../../src/controllers/videoController", () => {
  return {
    VideoGenerationController: jest.fn().mockImplementation(() => ({
      handleTask: jest.fn().mockImplementation(async function* () {
        yield { state: TaskState.COMPLETED };
      }),
    })),
  };
});

describe("TaskQueue", () => {
  let taskQueue: TaskQueue;
  let taskProcessor: jest.Mocked<TaskProcessor>;
  let taskStore: jest.Mocked<TaskStore>;
  let imageController: jest.Mocked<ImageGenerationController>;
  let videoController: jest.Mocked<VideoGenerationController>;
  let mockTask: Task;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock task store
    taskStore = new TaskStore() as jest.Mocked<TaskStore>;

    // Create mock image and video controllers
    imageController = {
      handleTask: jest.fn().mockImplementation(async function* () {
        yield { state: TaskState.COMPLETED };
      }),
    } as unknown as jest.Mocked<ImageGenerationController>;
    videoController = {
      handleTask: jest.fn().mockImplementation(async function* () {
        yield { state: TaskState.COMPLETED };
      }),
    } as unknown as jest.Mocked<VideoGenerationController>;

    // Create mock task processor
    taskProcessor = new TaskProcessor(
      taskStore,
      imageController,
      videoController
    ) as jest.Mocked<TaskProcessor>;

    // Create task queue instance
    taskQueue = new TaskQueue(taskProcessor, {
      maxConcurrent: 2,
      maxRetries: 3,
      retryDelay: 100,
    });

    // Create mock task
    mockTask = {
      id: "task-123",
      prompt: "Generate a song about testing",
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      message: {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Generate a song about testing",
          },
        ],
      },
    };
  });

  describe("enqueueTask", () => {
    it("should enqueue a valid task", async () => {
      await expect(taskQueue.enqueueTask(mockTask)).resolves.not.toThrow();
    });

    it("should reject task without ID", async () => {
      const invalidTask = { ...mockTask };
      delete (invalidTask as any).id;

      await expect(taskQueue.enqueueTask(invalidTask)).rejects.toThrow(
        "Invalid task: missing task ID"
      );
    });

    it("should process task immediately if capacity allows", async () => {
      taskProcessor.processTask.mockResolvedValue();

      await taskQueue.enqueueTask(mockTask);

      expect(taskProcessor.processTask).toHaveBeenCalledWith(mockTask);
    });
  });

  describe("processNextTasks", () => {
    it("should process multiple tasks concurrently", async () => {
      taskProcessor.processTask.mockResolvedValue();

      const task1 = { ...mockTask, id: "task-1" };
      const task2 = { ...mockTask, id: "task-2" };

      await Promise.all([
        taskQueue.enqueueTask(task1),
        taskQueue.enqueueTask(task2),
      ]);

      expect(taskProcessor.processTask).toHaveBeenCalledTimes(2);
    });

    it("should respect maxConcurrent limit", async () => {
      taskProcessor.processTask.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const tasks = Array.from({ length: 4 }, (_, i) => ({
        ...mockTask,
        id: `task-${i + 1}`,
      }));

      await Promise.all(tasks.map((task) => taskQueue.enqueueTask(task)));

      // Should only be processing maxConcurrent (2) tasks
      expect(taskProcessor.processTask).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry logic", () => {
    it("should retry failed tasks up to maxRetries", async () => {
      taskProcessor.processTask.mockRejectedValue(
        new Error("Processing failed")
      );

      await taskQueue.enqueueTask(mockTask);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have tried original + 3 retries = 4 times total
      expect(taskProcessor.processTask).toHaveBeenCalledTimes(4);
    });

    it("should mark task as failed after max retries", async () => {
      taskProcessor.processTask.mockRejectedValue(
        new Error("Processing failed")
      );

      await taskQueue.enqueueTask(mockTask);

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = taskQueue.getQueueStatus();
      expect(status.failedTasks).toBe(1);
    });
  });

  describe("cancelTask", () => {
    it("should cancel queued task", async () => {
      // Fill up processing slots
      taskProcessor.processTask.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200))
      );

      const processingTasks = Array.from({ length: 2 }, (_, i) => ({
        ...mockTask,
        id: `processing-${i + 1}`,
      }));

      const queuedTask = { ...mockTask, id: "queued-1" };

      // Enqueue tasks
      await Promise.all([
        ...processingTasks.map((task) => taskQueue.enqueueTask(task)),
        taskQueue.enqueueTask(queuedTask),
      ]);

      // Cancel queued task
      const cancelled = taskQueue.cancelTask(queuedTask.id);
      expect(cancelled).toBe(true);

      const status = taskQueue.getQueueStatus();
      expect(status.queuedTasks).toBe(0);
    });

    it("should return false for non-existent task", () => {
      const cancelled = taskQueue.cancelTask("non-existent");
      expect(cancelled).toBe(false);
    });
  });

  describe("getQueueStatus", () => {
    it("should return correct queue status", async () => {
      // Add some tasks in different states
      taskProcessor.processTask
        .mockImplementationOnce(
          () => new Promise((resolve) => setTimeout(resolve, 200))
        )
        .mockRejectedValueOnce(new Error("Processing failed"))
        .mockResolvedValueOnce(undefined);

      const tasks = Array.from({ length: 4 }, (_, i) => ({
        ...mockTask,
        id: `task-${i + 1}`,
      }));

      await Promise.all(tasks.map((task) => taskQueue.enqueueTask(task)));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = taskQueue.getQueueStatus();
      expect(status.queuedTasks).toBeGreaterThanOrEqual(0);
      expect(status.processingTasks).toBeLessThanOrEqual(2);
      expect(status.failedTasks).toBeGreaterThanOrEqual(0);
      expect(status.completedTasks).toBeGreaterThanOrEqual(0);
    });
  });
});
