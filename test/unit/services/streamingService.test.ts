/**
 * @file streamingService.test.ts
 * @description Unit tests for the StreamingService
 */

import { Response } from "express";
import { StreamingService } from "../../../src/services/streamingService";
import {
  Task,
  TaskState,
  TaskArtifact,
  TaskArtifactPart,
} from "../../../src/interfaces/a2a";

describe("StreamingService", () => {
  let service: StreamingService;
  let mockResponse: Partial<Response>;
  let mockTask: Task;

  beforeEach(() => {
    service = new StreamingService();

    // Mock response object
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
    };

    // Mock task
    mockTask = {
      id: "test-task-id",
      prompt: "test prompt",
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      message: {
        role: "user",
        parts: [{ type: "text" as const, text: "test prompt" }],
      },
    };
  });

  describe("subscribe", () => {
    it("should set up SSE headers correctly", () => {
      service.subscribe("test-task-id", mockResponse as Response);

      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    });

    it("should send initial connection event", () => {
      service.subscribe("test-task-id", mockResponse as Response);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"state":"submitted"')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"final":false')
      );
    });

    it("should set up disconnect handler", () => {
      service.subscribe("test-task-id", mockResponse as Response);

      expect(mockResponse.on).toHaveBeenCalledWith(
        "close",
        expect.any(Function)
      );
    });
  });

  describe("notifyTaskUpdate", () => {
    it("should send task updates to subscribed clients", () => {
      // Subscribe a client
      service.subscribe("test-task-id", mockResponse as Response);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Update task status
      const updatedTask = {
        ...mockTask,
        status: {
          state: TaskState.WORKING,
          timestamp: new Date().toISOString(),
        },
      };

      // Send notification
      service.notifyTaskUpdate(updatedTask);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"state":"working"')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"final":false')
      );
    });

    it("should send artifacts when available", () => {
      // Subscribe a client
      service.subscribe("test-task-id", mockResponse as Response);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Create artifact parts with correct type
      const artifactPart: TaskArtifactPart = {
        type: "text" as const,
        text: "Generated content",
      };

      // Create artifact with correct interface
      const artifact: TaskArtifact = {
        parts: [artifactPart],
        index: 0,
      };

      // Update task with artifacts
      const taskWithArtifact: Task = {
        ...mockTask,
        artifacts: [artifact],
      };

      // Send notification
      service.notifyTaskUpdate(taskWithArtifact);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"artifact"')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"Generated content"')
      );
    });

    it("should mark task as final when in completed state", () => {
      // Subscribe a client
      service.subscribe("test-task-id", mockResponse as Response);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Update task to completed state
      const completedTask = {
        ...mockTask,
        status: {
          state: TaskState.COMPLETED,
          timestamp: new Date().toISOString(),
        },
      };

      // Send notification
      service.notifyTaskUpdate(completedTask);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"final":true')
      );
    });
  });

  describe("unsubscribe", () => {
    it("should remove client from connections", () => {
      // Subscribe a client
      service.subscribe("test-task-id", mockResponse as Response);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Unsubscribe the client
      service.unsubscribe("test-task-id", mockResponse as Response);

      // Update task status
      const updatedTask = {
        ...mockTask,
        status: {
          state: TaskState.WORKING,
          timestamp: new Date().toISOString(),
        },
      };

      // Send notification
      service.notifyTaskUpdate(updatedTask);

      // Should not have received any notifications after unsubscribe
      expect(mockResponse.write).not.toHaveBeenCalled();
    });
  });
});
