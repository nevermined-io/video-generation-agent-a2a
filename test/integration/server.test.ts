/**
 * @file server.test.ts
 * @description Integration tests for the server and its routes
 */

import request from "supertest";
import express from "express";
import cors from "cors";
import a2aRoutes from "../../src/routes/a2aRoutes";
import { mockTaskRequest, createMockTask } from "../mocks/taskMocks";
import { TaskState, TaskRequest } from "../../src/interfaces/a2a";
import { TaskStore } from "../../src/core/taskStore";
import { SessionManager } from "../../src/core/sessionManager";
import { SongGenerationController } from "../../src/controllers/songController";
import { A2AController } from "../../src/controllers/a2aController";
import { Request, Response } from "express";

// Mock the A2AController module
jest.mock("../../src/controllers/a2aController", () => {
  return {
    A2AController: jest.fn().mockImplementation(() => ({
      healthCheck: jest.fn(),
      getAgentCard: jest.fn(),
      listTasks: jest.fn(),
      sendTask: jest.fn(),
      sendTaskSubscribe: jest.fn(),
      getTaskStatus: jest.fn(),
      cancelTask: jest.fn(),
      getTaskHistory: jest.fn(),
      setPushNotification: jest.fn(),
      getPushNotification: jest.fn(),
    })),
  };
});

describe("Server Tests", () => {
  let app: express.Application;
  let mockController: jest.Mocked<A2AController>;

  beforeEach(() => {
    mockController = {
      healthCheck: jest
        .fn()
        .mockImplementation(
          async (req: Request, res: Response): Promise<void> => {
            res.json({ status: "ok" });
          }
        ),
      getAgentCard: jest
        .fn()
        .mockImplementation(
          async (req: Request, res: Response): Promise<void> => {
            res.json({
              name: "Test Agent",
              description: "Test Description",
              version: "1.0.0",
            });
          }
        ),
      generateSong: jest
        .fn()
        .mockImplementation(
          async (req: Request, res: Response): Promise<void> => {
            res.status(202).json({ taskId: "test-task-id" });
          }
        ),
      checkTaskStatus: jest
        .fn()
        .mockImplementation(async (taskId: string): Promise<boolean> => {
          return taskId === "test-task-id";
        }),
      getSongResult: jest
        .fn()
        .mockImplementation(
          async (req: Request, res: Response): Promise<void> => {
            res.json({ url: "test-url" });
          }
        ),
      getTaskResult: jest
        .fn()
        .mockImplementation(
          async (req: Request, res: Response): Promise<void> => {
            res.json({
              state: TaskState.COMPLETED,
              result: "test-result",
            });
          }
        ),
    } as jest.Mocked<A2AController>;

    app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/", a2aRoutes);

    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * @test Health Check Endpoint
   * @description Tests the health check endpoint returns correct status
   */
  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const response = await request(app)
        .get("/health")
        .set("Accept", "application/json")
        .expect(200);

      expect(response.body).toEqual({ status: "ok" });
    });
  });

  /**
   * @test Agent Card Endpoint
   * @description Tests the agent card endpoint returns correct data
   */
  describe("GET /.well-known/agent.json", () => {
    it("should return agent card information", async () => {
      const response = await request(app)
        .get("/.well-known/agent.json")
        .set("Accept", "application/json")
        .expect(200);

      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("description");
      expect(response.body).toHaveProperty("version");
    });
  });

  /**
   * @test Task Management Endpoints
   * @description Tests the task management related endpoints
   */
  describe("Task Management", () => {
    it("should create a new task", async () => {
      const response = await request(app)
        .post("/tasks/send")
        .set("Accept", "application/json")
        .send(mockTaskRequest)
        .expect(200);

      expect(response.body).toHaveProperty("id");
    });

    it("should get task status", async () => {
      const taskId = "test-task-id";
      const response = await request(app)
        .get(`/tasks/${taskId}`)
        .set("Accept", "application/json")
        .expect(200);

      expect(response.body).toHaveProperty("id", taskId);
    });

    it("should cancel a task", async () => {
      const taskId = "test-task-id";
      const response = await request(app)
        .post(`/tasks/${taskId}/cancel`)
        .set("Accept", "application/json")
        .expect(200);

      expect(response.body.status.state).toBe(TaskState.CANCELLED);
    });
  });

  /**
   * @test Error Handling
   * @description Tests error handling scenarios
   */
  describe("Error Handling", () => {
    it("should handle invalid task creation", async () => {
      const invalidTask = {};
      const response = await request(app)
        .post("/tasks/send")
        .set("Accept", "application/json")
        .send(invalidTask)
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should handle non-existent task", async () => {
      const nonExistentId = "non-existent";
      const response = await request(app)
        .get(`/tasks/${nonExistentId}`)
        .set("Accept", "application/json")
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });

    it("should handle invalid task cancellation", async () => {
      const response = await request(app)
        .post("/tasks/non-existent-id/cancel")
        .set("Accept", "application/json")
        .expect(404);

      expect(response.body).toHaveProperty("error");
    });
  });
});
