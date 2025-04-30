/**
 * @file errorHandler.test.ts
 * @description Tests for ErrorHandler implementation
 */

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  ErrorHandler,
  A2AError,
  TaskTimeoutError,
  TaskCancellationError,
} from "../../../src/core/errorHandler";
import { TaskStore } from "../../../src/core/taskStore";
import { Logger } from "../../../src/utils/logger";
import { Task, TaskState } from "../../../src/interfaces/a2a";
import { createMockTask } from "../../mocks/taskMocks";

type MockTaskStore = {
  [K in keyof TaskStore]: jest.MockedFunction<TaskStore[K]>;
};

// Mock TaskStore
const mockTaskStore = {
  addTask: jest.fn(),
  getTask: jest
    .fn()
    .mockReturnValue(Promise.resolve(undefined)) as jest.MockedFunction<
    (taskId: string) => Promise<Task | null>
  >,
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  listTasks: jest.fn(),
} as unknown as jest.Mocked<TaskStore>;

// Mock Logger
jest.mock("../../../src/utils/logger", () => ({
  Logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let mockTask: Task;

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockTaskStore);
    mockTask = createMockTask();
    jest.clearAllMocks();
  });

  describe("handleError", () => {
    it("should handle error and update task status", async () => {
      const error = new A2AError("Test error", "TEST_ERROR");
      mockTaskStore.getTask.mockResolvedValue(mockTask);

      await errorHandler.handleError(error, mockTask.id);

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Test error"),
        expect.any(Object)
      );
      expect(mockTaskStore.updateTask).toHaveBeenCalledWith({
        ...mockTask,
        status: {
          state: TaskState.FAILED,
          timestamp: expect.any(String),
          message: {
            role: "agent",
            parts: [
              {
                type: "text",
                text: "Test error",
              },
            ],
          },
        },
      });
    });

    it("should handle retry attempts", async () => {
      const error = new A2AError("Test error", "TEST_ERROR");
      error.retryAttempt = 1;
      mockTaskStore.getTask.mockResolvedValue(mockTask);

      await errorHandler.handleError(error, mockTask.id);

      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Attempting retry"),
        expect.any(Object)
      );
    });

    it("should handle max retries reached", async () => {
      const error = new A2AError("Test error", "TEST_ERROR");
      error.retryAttempt = 3;
      mockTaskStore.getTask.mockResolvedValue(mockTask);

      await errorHandler.handleError(error, mockTask.id);

      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Max retry attempts"),
        expect.any(Object)
      );
    });
  });

  describe("withTimeout", () => {
    it("should resolve when promise completes before timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await errorHandler.withTimeout(promise, 1000);
      expect(result).toBe("success");
    });

    it("should reject with TaskTimeoutError when timeout occurs", async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      await expect(errorHandler.withTimeout(slowPromise, 100)).rejects.toThrow(
        TaskTimeoutError
      );
    });
  });
});
