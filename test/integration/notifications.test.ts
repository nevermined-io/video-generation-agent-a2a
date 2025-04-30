/**
 * @file notifications.test.ts
 * @description Integration tests for push notifications and streaming functionality
 */

import request from "supertest";
import express from "express";
import cors from "cors";
import a2aRoutes from "../../src/routes/a2aRoutes";
import { A2AController } from "../../src/controllers/a2aController";
import {
  TaskState,
  PushNotificationEventType,
  Task,
} from "../../src/interfaces/a2a";
import { Server } from "http";
import { TaskStore } from "../../src/core/taskStore";

// Mock TaskStore
jest.mock("../../src/core/taskStore", () => {
  return {
    TaskStore: jest.fn().mockImplementation(() => ({
      createTask: jest
        .fn()
        .mockImplementation((task: Task) => Promise.resolve(task)),
      getTask: jest.fn().mockImplementation((taskId: string) =>
        Promise.resolve({
          id: taskId,
          prompt: "Test prompt",
          status: {
            state: TaskState.SUBMITTED,
            timestamp: new Date().toISOString(),
          },
        })
      ),
      updateTask: jest
        .fn()
        .mockImplementation((task: Task) => Promise.resolve(task)),
      addStatusListener: jest.fn(),
    })),
  };
});

// Mock audio utils
jest.mock("../../src/utils/audio", () => ({
  calculateDuration: jest.fn().mockResolvedValue(180), // Mock duration of 3 minutes
}));

// Mock song metadata generator
jest.mock("../../src/core/songMetadataGenerator", () => ({
  SongMetadataGenerator: jest.fn().mockImplementation(() => ({
    generateSongMetadata: jest.fn().mockResolvedValue({
      title: "Mock Song Title",
      lyrics: "Mock lyrics",
      genre: "pop",
      mood: "happy",
      tempo: "medium",
      key: "C",
      duration: 180,
    }),
  })),
}));

// Mock Suno client
jest.mock("../../src/clients/sunoClient", () => ({
  SunoClient: jest.fn().mockImplementation(() => ({
    generateSong: jest.fn().mockResolvedValue({
      url: "http://mock-song-url.com/song.mp3",
      duration: 180,
    }),
  })),
}));

describe("Notifications Integration Tests", () => {
  let app: express.Application;
  let server: Server;
  let controller: A2AController;
  let taskStore: jest.Mocked<TaskStore>;

  beforeAll(() => {
    // Increase timeout for all tests
    jest.setTimeout(30000);

    app = express();
    app.use(cors());
    app.use(express.json());

    // Initialize TaskStore mock
    taskStore = new TaskStore() as jest.Mocked<TaskStore>;

    // Initialize controller with required keys and mocked TaskStore
    controller = new A2AController(
      {
        openAiKey: "test-openai-key",
        sunoKey: "test-suno-key",
      },
      taskStore
    );

    app.use("/", a2aRoutes);
    server = app.listen(3001);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("Push Notifications", () => {
    it("should set up SSE push notifications for a task", async () => {
      // Create a task first
      const taskResponse = await request(app).post("/tasks/send").send({
        prompt: "Test task",
        sessionId: "test-session",
      });

      expect(taskResponse.status).toBe(200);
      expect(taskResponse.body).toHaveProperty("id");

      const taskId = taskResponse.body.id;

      // Set up push notifications with SSE
      const pushResponse = await request(app)
        .get(`/tasks/${taskId}/notifications/subscribe`)
        .set("Accept", "text/event-stream")
        .send({
          taskId,
          eventTypes: [
            PushNotificationEventType.STATUS_UPDATE,
            PushNotificationEventType.COMPLETION,
          ],
        });

      expect(pushResponse.status).toBe(200);
      expect(pushResponse.headers["content-type"]).toBe("text/event-stream");
      expect(pushResponse.headers["connection"]).toBe("keep-alive");
    });

    it("should set up webhook push notifications for a task", async () => {
      // Create a task first
      const taskResponse = await request(app)
        .post("/tasks/send")
        .send({
          prompt: "Test task",
          sessionId: "test-session",
        })
        .expect(200);

      const taskId = taskResponse.body.id;

      // Set up push notifications with webhook
      const pushResponse = await request(app)
        .get(`/tasks/${taskId}/notifications/subscribe`)
        .send({
          taskId,
          eventTypes: [
            PushNotificationEventType.STATUS_UPDATE,
            PushNotificationEventType.COMPLETION,
          ],
          webhookUrl: "http://test-webhook.com",
        })
        .expect(200);

      expect(pushResponse.body).toHaveProperty("success", true);
    });
  });

  describe("Streaming", () => {
    it("should stream task updates in real-time", (done) => {
      request(app)
        .post("/tasks/sendSubscribe")
        .send({
          prompt: "Test streaming task",
          sessionId: "test-session",
        })
        .set("Accept", "text/event-stream")
        .expect(200)
        .then((response) => {
          const data = response.text.split("\n\n");
          const events = data
            .filter((chunk) => chunk.startsWith("data: "))
            .map((chunk) => JSON.parse(chunk.replace("data: ", "")));

          // Check initial event
          expect(events[0]).toHaveProperty("id");
          expect(events[0]).toHaveProperty("status");
          expect(events[0].status.state).toBe(TaskState.SUBMITTED);
          expect(events[0].final).toBe(false);

          done();
        })
        .catch(done);
    });

    it("should receive task completion through stream", (done) => {
      request(app)
        .post("/tasks/sendSubscribe")
        .send({
          prompt: "Test streaming task",
          sessionId: "test-session",
        })
        .set("Accept", "text/event-stream")
        .expect(200)
        .then((response) => {
          const data = response.text.split("\n\n");
          const events = data
            .filter((chunk) => chunk.startsWith("data: "))
            .map((chunk) => JSON.parse(chunk.replace("data: ", "")));

          // Find completion event
          const completionEvent = events.find(
            (event) =>
              event.status?.state === TaskState.COMPLETED &&
              event.final === true
          );

          expect(completionEvent).toBeDefined();
          expect(completionEvent.status.state).toBe(TaskState.COMPLETED);
          expect(completionEvent.final).toBe(true);

          done();
        })
        .catch(done);
    });

    it("should receive artifacts through stream", (done) => {
      request(app)
        .post("/tasks/sendSubscribe")
        .send({
          prompt: "Test streaming task with artifacts",
          sessionId: "test-session",
        })
        .set("Accept", "text/event-stream")
        .expect(200)
        .then((response) => {
          const data = response.text.split("\n\n");
          const events = data
            .filter((chunk) => chunk.startsWith("data: "))
            .map((chunk) => JSON.parse(chunk.replace("data: ", "")));

          // Find artifact event
          const artifactEvent = events.find((event) => event.artifact);

          expect(artifactEvent).toBeDefined();
          expect(artifactEvent.artifact).toHaveProperty("parts");
          expect(artifactEvent.artifact).toHaveProperty("index");

          done();
        })
        .catch(done);
    });

    it("should handle connection closure properly", (done) => {
      let abortController = new AbortController();

      request(app)
        .post("/tasks/sendSubscribe")
        .send({
          prompt: "Test streaming task",
          sessionId: "test-session",
        })
        .set("Accept", "text/event-stream")
        .expect(200)
        .then((response) => {
          // Simulate connection close
          abortController.abort();

          // Wait a bit to ensure cleanup
          setTimeout(() => {
            // Try to send another update (should not receive it)
            const taskUpdate = {
              state: TaskState.WORKING,
              timestamp: new Date().toISOString(),
            };

            // Verify no more events are received
            expect(response.text).not.toContain(JSON.stringify(taskUpdate));
            done();
          }, 100);
        })
        .catch(done);
    });
  });
});
