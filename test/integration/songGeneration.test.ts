/**
 * @file song_generation.test.ts
 * @description Integration tests for the complete song generation flow
 */

import { SongGenerationController } from "../../src/controllers/songController";
import { SessionManager } from "../../src/core/sessionManager";
import { TaskStore } from "../../src/core/taskStore";
import { Task, TaskState, TaskYieldUpdate } from "../../src/interfaces/a2a";
import { Logger } from "../../src/utils/logger";
import { v4 as uuidv4 } from "uuid";

describe("Song Generation Integration", () => {
  let taskStore: TaskStore;
  let sessionManager: SessionManager;
  let controller: SongGenerationController;
  let mockTask: Task;

  beforeAll(() => {
    // Initialize components with mock API keys
    taskStore = new TaskStore();
    sessionManager = new SessionManager();
    controller = new SongGenerationController(
      "mock-openai-key",
      "mock-suno-key"
    );
  });

  beforeEach(() => {
    // Create a mock task before each test
    mockTask = {
      id: uuidv4(),
      sessionId: uuidv4(),
      prompt: "Generate a happy pop song about summer",
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      message: {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Generate a happy pop song about summer",
          },
        ],
      },
      history: [], // Initialize history array
    };

    jest.clearAllMocks();
  });

  // Mock implementations
  const mockMetadataGenerator = {
    generate: jest.fn().mockImplementation(async (idea: string) => {
      if (!idea || !idea.trim()) {
        throw new Error("Invalid or missing prompt");
      }
      return {
        title: "Test Song",
        lyrics:
          "[Verse 1]\nTest verse 1\n[Verse 2]\nTest verse 2\n[Verse 3]\nTest verse 3\n[Chorus]\nTest chorus",
        tags: ["pop", "happy", "energetic"],
      };
    }),
  };

  const mockSunoClient = {
    generateSong: jest.fn().mockResolvedValue({
      id: "test-job-id",
      status: "SUBMITTED",
      progress: 0,
    }),
    waitForCompletion: jest
      .fn()
      .mockImplementation(async (jobId: string, options: any) => {
        // Simulate progress updates
        if (options.onStatusUpdate) {
          await options.onStatusUpdate({ progress: 50, status: "PROCESSING" });
          await options.onStatusUpdate({ progress: 100, status: "COMPLETED" });
        }

        return {
          jobId: "test-job-id",
          music: {
            musicId: "test-music-id",
            title: "Test Song",
            audioUrl: "https://example.com/test.mp3",
            duration: 180,
          },
          metadata: {
            title: "Test Song",
            lyrics:
              "[Verse 1]\nTest verse 1\n[Verse 2]\nTest verse 2\n[Verse 3]\nTest verse 3\n[Chorus]\nTest chorus",
            tags: ["pop", "happy", "energetic"],
          },
        };
      }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore - Ignorar error de tipos al asignar los mocks
    controller = new SongGenerationController(
      "test-openai-key",
      "test-suno-key"
    );
    Object.defineProperty(controller, "metadataGenerator", {
      value: mockMetadataGenerator,
      writable: true,
    });
    Object.defineProperty(controller, "sunoClient", {
      value: mockSunoClient,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * @test
   * @description Should complete the full song generation flow successfully
   */
  it("should complete the full song generation flow", async () => {
    // Save the task
    await taskStore.createTask(mockTask);

    // Create task context
    const context = {
      task: mockTask,
      isCancelled: () => false,
    };

    // Execute the task handler
    const generator = controller.handleTask(context);
    const updates: TaskYieldUpdate[] = [];

    // Collect all updates
    for await (const update of generator) {
      updates.push(update);
    }

    // Verify the flow
    expect(updates).toHaveLength(4); // Initial, Metadata, Generation, Completion

    // Verify initial state
    expect(updates[0].state).toBe(TaskState.WORKING);
    expect(updates[0].message?.parts[0].text).toContain(
      "Starting song generation"
    );

    // Verify metadata generation
    expect(updates[1].state).toBe(TaskState.WORKING);
    expect(updates[1].message?.parts[0].text).toContain(
      "Generating song metadata"
    );

    // Verify song generation
    expect(updates[2].state).toBe(TaskState.WORKING);
    expect(updates[2].message?.parts[0].text).toContain("Generating audio");

    // Verify completion
    expect(updates[3].state).toBe(TaskState.COMPLETED);
    expect(updates[3].artifacts).toBeDefined();
    expect(updates[3].artifacts?.[0].parts[0].audioUrl).toBe(
      "https://example.com/test.mp3"
    );
  });

  /**
   * @test
   * @description Should handle invalid input properly
   */
  it("should handle empty prompt correctly", async () => {
    // Create task with empty prompt
    const emptyPromptTask: Task = {
      ...mockTask,
      prompt: "",
      message: {
        role: "user",
        parts: [
          {
            type: "text",
            text: "",
          },
        ],
      },
    };

    await taskStore.createTask(emptyPromptTask);

    const context = {
      task: emptyPromptTask,
      isCancelled: () => false,
    };

    const generator = controller.handleTask(context);
    const updates: TaskYieldUpdate[] = [];

    for await (const update of generator) {
      updates.push(update);
    }

    // Verify that the last update is INPUT_REQUIRED
    const lastUpdate = updates[updates.length - 1];
    expect(lastUpdate.state).toBe(TaskState.INPUT_REQUIRED);
    expect(lastUpdate.message?.parts[0].text).toContain(
      "No prompt was provided"
    );
  });

  /**
   * @test
   * @description Should handle task cancellation
   */
  it("should handle task cancellation", async () => {
    await taskStore.createTask(mockTask);

    const context = {
      task: mockTask,
      isCancelled: () => true, // Simulate cancellation
    };

    const generator = controller.handleTask(context);
    const updates: TaskYieldUpdate[] = [];

    for await (const update of generator) {
      updates.push(update);
    }

    expect(updates[updates.length - 1].state).toBe(TaskState.CANCELLED);
  });

  /**
   * @test
   * @description Should persist task history correctly
   */
  it("should maintain correct task history", async () => {
    await taskStore.createTask(mockTask);

    const context = {
      task: mockTask,
      isCancelled: () => false,
    };

    // Initialize history with SUBMITTED state
    mockTask.history = [
      {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
        message: {
          role: "agent",
          parts: [
            {
              type: "text",
              text: "Task submitted",
            },
          ],
        },
      },
    ];

    const generator = controller.handleTask(context);
    for await (const update of generator) {
      // Add updates to history
      if (mockTask.history) {
        mockTask.history.push({
          state: update.state,
          timestamp: new Date().toISOString(),
          message: update.message,
        });
      }
    }

    await taskStore.updateTask(mockTask);

    // Verify task history
    const updatedTask = await taskStore.getTask(mockTask.id);
    expect(updatedTask?.history).toBeDefined();
    expect(updatedTask?.history?.length).toBeGreaterThan(0);
    expect(updatedTask?.history?.[0].state).toBe(TaskState.SUBMITTED);
  });
});
