/**
 * @file taskProcessor.test.ts
 * @description Tests for TaskProcessor implementation
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { TaskProcessor } from "../../../src/core/taskProcessor";
import { TaskStore } from "../../../src/core/taskStore";
import {
  Task,
  TaskState,
  Message,
  TaskContext,
} from "../../../src/interfaces/a2a";
import { Logger } from "../../../src/utils/logger";
import { SongGenerationController } from "../../../src/controllers/songController";

// Mock Logger
jest.mock("../../../src/utils/logger");

// Mock SongGenerationController
jest.mock("../../../src/controllers/songController", () => {
  return {
    SongGenerationController: jest.fn().mockImplementation(() => ({
      handleTask: jest.fn().mockImplementation(async function* () {
        yield {
          state: TaskState.COMPLETED,
          message: {
            role: "agent",
            parts: [{ type: "text", text: "Song generated successfully" }],
          },
        };
      }),
    })),
  };
});

describe("TaskProcessor", () => {
  let taskProcessor: TaskProcessor;
  let taskStore: TaskStore;
  let mockTask: Task;
  let songController: jest.Mocked<SongGenerationController>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock task store
    taskStore = new TaskStore();

    // Create mock song controller with required API keys
    songController = new SongGenerationController(
      "test-openai-key",
      "test-suno-key"
    ) as jest.Mocked<SongGenerationController>;

    // Create task processor instance
    taskProcessor = new TaskProcessor(taskStore, songController);

    // Create mock task
    mockTask = {
      id: "task-123",
      prompt: "Generate a song about coding",
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      message: {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Generate a song about coding",
          },
        ],
      },
    };
  });

  describe("processTask", () => {
    it("should process a valid task successfully", async () => {
      // Create the task first
      await taskStore.createTask(mockTask);

      // Spy on taskStore.updateTask
      const updateTaskSpy = jest.spyOn(taskStore, "updateTask");

      // Process the task
      await taskProcessor.processTask(mockTask);

      // Verify task was updated to COMPLETED state
      expect(updateTaskSpy).toHaveBeenCalledTimes(2);

      const lastCall = updateTaskSpy.mock.calls[1][0];
      expect(lastCall.status.state).toBe(TaskState.COMPLETED);
      expect(lastCall.status.message?.role).toBe("agent");
    });

    it("should handle invalid task data", async () => {
      const invalidTask = {
        ...mockTask,
        message: {
          role: "user" as const,
          parts: [],
        },
      };

      // Create the task first
      await taskStore.createTask(invalidTask);

      await expect(taskProcessor.processTask(invalidTask)).rejects.toThrow(
        "Task must contain a non-empty text prompt"
      );
    });

    it("should handle task without text prompt", async () => {
      const taskWithoutText = {
        ...mockTask,
        message: {
          role: "user" as const,
          parts: [
            {
              type: "image" as const,
              url: "http://example.com/image.jpg",
            },
          ],
        },
      };

      // Create the task first
      await taskStore.createTask(taskWithoutText);

      await expect(taskProcessor.processTask(taskWithoutText)).rejects.toThrow(
        "Task must contain a non-empty text prompt"
      );
    });

    it("should update task status to WORKING when processing starts", async () => {
      // Create the task first
      await taskStore.createTask(mockTask);

      const updateTaskSpy = jest.spyOn(taskStore, "updateTask");

      try {
        await taskProcessor.processTask(mockTask);
      } catch (error) {
        // Ignore any errors
      }

      // Verify first status update was to WORKING
      const firstCall = updateTaskSpy.mock.calls[0][0];
      expect(firstCall.status.state).toBe(TaskState.WORKING);
    });

    it("should handle processing errors and update status to FAILED", async () => {
      // Create the task first
      await taskStore.createTask(mockTask);

      // Mock songController.handleTask to throw error
      songController.handleTask.mockImplementationOnce(async function* () {
        throw new Error("Processing failed");
      });

      const updateTaskSpy = jest.spyOn(taskStore, "updateTask");

      await expect(taskProcessor.processTask(mockTask)).rejects.toThrow(
        "Processing failed"
      );

      // Verify task was updated to FAILED state
      const lastCall =
        updateTaskSpy.mock.calls[updateTaskSpy.mock.calls.length - 1][0];
      expect(lastCall.status.state).toBe(TaskState.FAILED);
      expect(lastCall.status.message?.parts[0].text).toContain(
        "Processing failed"
      );
    });

    it("should maintain task history during status updates", async () => {
      // Create the task first
      await taskStore.createTask(mockTask);

      const updateTaskSpy = jest.spyOn(taskStore, "updateTask");

      await taskProcessor.processTask(mockTask);

      // Verify history was maintained in updates
      const lastCall =
        updateTaskSpy.mock.calls[updateTaskSpy.mock.calls.length - 1][0];
      expect(lastCall.history).toBeDefined();
      expect(lastCall.history?.length).toBeGreaterThan(0);
      expect(lastCall.history?.map((h) => h.state)).toContain(
        TaskState.WORKING
      );
      expect(lastCall.history?.map((h) => h.state)).toContain(
        TaskState.COMPLETED
      );
    });
  });

  describe("validateTask", () => {
    it("should validate task with valid message", () => {
      expect(() => {
        (taskProcessor as any).validateTask(mockTask);
      }).not.toThrow();
    });

    it("should throw error for task without message", () => {
      const invalidTask = { ...mockTask };
      delete invalidTask.message;

      expect(() => {
        (taskProcessor as any).validateTask(invalidTask);
      }).toThrow("Task message is empty or invalid");
    });

    it("should throw error for task with empty parts array", () => {
      const invalidTask = {
        ...mockTask,
        message: {
          role: "user",
          parts: [],
        },
      };

      expect(() => {
        (taskProcessor as any).validateTask(invalidTask);
      }).toThrow("Task must contain a non-empty text prompt");
    });
  });
});
