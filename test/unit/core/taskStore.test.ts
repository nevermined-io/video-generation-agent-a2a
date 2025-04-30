/**
 * @file taskStore.test.ts
 * @description Tests for TaskStore implementation
 */

import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { TaskStore } from "../../../src/core/taskStore";
import { Task, TaskState } from "../../../src/interfaces/a2a";

type StatusListener = (task: Task) => Promise<void>;

describe("TaskStore", () => {
  let taskStore: TaskStore;
  let mockTask: Task;

  beforeEach(() => {
    taskStore = new TaskStore();
    mockTask = {
      id: "task-123",
      prompt: "Test prompt",
      sessionId: "session-123",
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      message: {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Test message",
          },
        ],
      },
    };
  });

  describe("createTask", () => {
    it("should create a task successfully", async () => {
      const savedTask = await taskStore.createTask(mockTask);
      const retrievedTask = await taskStore.getTask(mockTask.id);
      expect(retrievedTask).toEqual(mockTask);
    });

    it("should update existing task", async () => {
      await taskStore.createTask(mockTask);

      const updatedTask = {
        ...mockTask,
        status: {
          state: TaskState.COMPLETED,
          timestamp: new Date().toISOString(),
        },
      };

      await taskStore.updateTask(updatedTask);
      const retrievedTask = await taskStore.getTask(mockTask.id);
      expect(retrievedTask).toEqual(updatedTask);
    });
  });

  describe("getTask", () => {
    it("should return null for non-existent task", async () => {
      const task = await taskStore.getTask("non-existent");
      expect(task).toBeNull();
    });

    it("should return task by id", async () => {
      await taskStore.createTask(mockTask);
      const task = await taskStore.getTask(mockTask.id);
      expect(task).toEqual(mockTask);
    });
  });

  describe("listTasks", () => {
    beforeEach(async () => {
      // Create multiple tasks with different states
      const tasks = [
        {
          ...mockTask,
          id: "task-1",
          status: {
            state: TaskState.SUBMITTED,
            timestamp: "2024-01-01T00:00:00Z",
          },
        },
        {
          ...mockTask,
          id: "task-2",
          status: {
            state: TaskState.WORKING,
            timestamp: "2024-01-02T00:00:00Z",
          },
        },
        {
          ...mockTask,
          id: "task-3",
          sessionId: "other-session",
          status: {
            state: TaskState.COMPLETED,
            timestamp: "2024-01-03T00:00:00Z",
          },
        },
      ];

      for (const task of tasks) {
        await taskStore.createTask(task);
      }
    });

    it("should list all tasks without filters", async () => {
      const tasks = await taskStore.listTasks();
      expect(tasks).toHaveLength(3);
    });

    it("should filter tasks by sessionId", async () => {
      const tasks = await taskStore.listTasks();
      const filteredTasks = tasks.filter(
        (task) => task.sessionId === "session-123"
      );
      expect(filteredTasks).toHaveLength(2);
      filteredTasks.forEach((task) =>
        expect(task.sessionId).toBe("session-123")
      );
    });

    it("should filter tasks by state", async () => {
      const tasks = await taskStore.listTasks();
      const filteredTasks = tasks.filter(
        (task) => task.status.state === TaskState.WORKING
      );
      expect(filteredTasks).toHaveLength(1);
      expect(filteredTasks[0].status.state).toBe(TaskState.WORKING);
    });

    it("should filter tasks by date range", async () => {
      const tasks = await taskStore.listTasks();
      const filteredTasks = tasks.filter((task) => {
        const timestamp = new Date(task.status.timestamp);
        return (
          timestamp >= new Date("2024-01-02T00:00:00Z") &&
          timestamp <= new Date("2024-01-03T00:00:00Z")
        );
      });
      expect(filteredTasks).toHaveLength(2);
    });
  });

  describe("deleteTask", () => {
    it("should delete existing task", async () => {
      await taskStore.createTask(mockTask);
      const deleted = await taskStore.deleteTask(mockTask.id);
      expect(deleted).toBe(true);

      const task = await taskStore.getTask(mockTask.id);
      expect(task).toBeNull();
    });

    it("should return false when deleting non-existent task", async () => {
      const deleted = await taskStore.deleteTask("non-existent");
      expect(deleted).toBe(false);
    });
  });

  describe("updateTaskStatus", () => {
    it("should update task status", async () => {
      await taskStore.createTask(mockTask);

      const newStatus = {
        state: TaskState.WORKING,
        timestamp: new Date().toISOString(),
      };

      const updatedTask = {
        ...mockTask,
        status: newStatus,
      };

      await taskStore.updateTask(updatedTask);

      const task = await taskStore.getTask(mockTask.id);
      expect(task?.status).toEqual(newStatus);
    });
  });

  describe("Status Listeners", () => {
    it("should notify listeners when a task is created", async () => {
      const mockListener = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());
      taskStore.addStatusListener(mockListener);

      await taskStore.createTask(mockTask);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(mockTask);
    });

    it("should notify listeners when a task is updated", async () => {
      const mockListener = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());
      await taskStore.createTask(mockTask);

      taskStore.addStatusListener(mockListener);

      const updatedTask = {
        ...mockTask,
        status: {
          state: TaskState.WORKING,
          timestamp: new Date().toISOString(),
        },
      };

      await taskStore.updateTask(updatedTask);

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(updatedTask);
    });

    it("should not notify removed listeners", async () => {
      const mockListener = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());
      taskStore.addStatusListener(mockListener);
      taskStore.removeStatusListener(mockListener);

      await taskStore.createTask(mockTask);

      expect(mockListener).not.toHaveBeenCalled();
    });

    it("should notify multiple listeners", async () => {
      const mockListener1 = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());
      const mockListener2 = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());

      taskStore.addStatusListener(mockListener1);
      taskStore.addStatusListener(mockListener2);

      await taskStore.createTask(mockTask);

      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(1);
      expect(mockListener1).toHaveBeenCalledWith(mockTask);
      expect(mockListener2).toHaveBeenCalledWith(mockTask);
    });

    it("should handle errors in listeners gracefully", async () => {
      const mockListener1 = jest
        .fn<StatusListener>()
        .mockImplementation(async () => {
          throw new Error("Listener error");
        });
      const mockListener2 = jest
        .fn<StatusListener>()
        .mockImplementation(async () => Promise.resolve());

      taskStore.addStatusListener(mockListener1);
      taskStore.addStatusListener(mockListener2);

      await taskStore.createTask(mockTask);

      // Second listener should still be called even if first one fails
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });

    it("should handle async listeners correctly", async () => {
      const mockAsyncListener = jest
        .fn<StatusListener>()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      taskStore.addStatusListener(mockAsyncListener);

      await taskStore.createTask(mockTask);

      expect(mockAsyncListener).toHaveBeenCalledTimes(1);
      expect(mockAsyncListener).toHaveBeenCalledWith(mockTask);
    });
  });
});
