/**
 * @file song_generation.e2e.ts
 * @description End-to-end tests for the song generation agent
 */

import { SongGenerationController } from "../../src/controllers/songController";
import { SessionManager } from "../../src/core/sessionManager";
import { TaskStore } from "../../src/core/taskStore";
import { Task, TaskState, TaskYieldUpdate } from "../../src/interfaces/a2a";
import { A2AController } from "../../src/controllers/a2aController";
import * as dotenv from "dotenv";
import axios from "axios";
import path from "path";

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Verify API keys are loaded
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUNO_API_KEY = process.env.SUNO_API_KEY;

if (!OPENAI_API_KEY || !SUNO_API_KEY) {
  console.error("Missing required API keys:");
  if (!OPENAI_API_KEY) console.error("- OPENAI_API_KEY is not set");
  if (!SUNO_API_KEY) console.error("- SUNO_API_KEY is not set");
  process.exit(1);
}

// Set timeout for all tests - songs can take a while to generate
jest.setTimeout(600000); // 10 minutes

// Helper function to format JSON output
function prettyPrint(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * @function validateAudioUrl
 * @description Validates that an audio URL is accessible and returns a valid MP3
 */
async function validateAudioUrl(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url);
    const contentType = response.headers["content-type"];
    return response.status === 200 && contentType?.includes("audio/mpeg");
  } catch (error) {
    console.error("Error validating audio URL:", error);
    return false;
  }
}

describe("Song Generation E2E", () => {
  let taskStore: TaskStore;
  let sessionManager: SessionManager;
  let controller: SongGenerationController;
  let a2aController: A2AController;
  let createdTaskIds: string[] = [];

  beforeAll(() => {
    taskStore = new TaskStore();
    sessionManager = new SessionManager();
    controller = new SongGenerationController(OPENAI_API_KEY, SUNO_API_KEY);
    a2aController = new A2AController({}, taskStore, sessionManager);

    console.log("Test environment initialized with:");
    console.log("- OpenAI API Key:", OPENAI_API_KEY.substring(0, 10) + "...");
    console.log("- Suno API Key:", SUNO_API_KEY.substring(0, 10) + "...");
  });

  afterEach(async () => {
    // Limpiar todas las tareas creadas durante el test
    for (const taskId of createdTaskIds) {
      try {
        await taskStore.deleteTask(taskId);
        console.log(`Cleaned up task: ${taskId}`);
      } catch (error) {
        console.warn(`Failed to clean up task ${taskId}:`, error);
      }
    }
    createdTaskIds = []; // Reset the list
  });

  /**
   * @test
   * @description Should handle the complete song generation process including metadata and audio
   */
  it("should handle complete song generation process", async () => {
    const prompt =
      "Generate a rock song about space exploration, with themes of discovery and adventure. Include references to stars, planets, and the excitement of venturing into the unknown.";
    const task = await a2aController.createTask(prompt);
    createdTaskIds.push(task.id);

    console.log(`Created test task with ID: ${task.id}`);

    const context = {
      task,
      isCancelled: () => false,
    };

    const generator = controller.handleTask(context);
    const updates: TaskYieldUpdate[] = [];

    // Track process stages
    let stages = {
      metadataGenerationStarted: false,
      metadataGenerated: false,
      audioGenerationStarted: false,
      audioGenerationProgress: false,
      audioGenerated: false,
    };

    let openAIResponse: TaskYieldUpdate | undefined;
    let sunoResponse: TaskYieldUpdate | undefined;

    try {
      for await (const update of generator) {
        updates.push(update);
        console.log("\n=== Update ===");
        console.log("State:", update.state);
        console.log("Message:", update.message?.parts[0].text);

        const messageText = update.message?.parts[0].text || "";
        console.log("\nRaw message:", messageText);

        // Track OpenAI metadata generation
        if (messageText.includes("Generating song metadata")) {
          stages.metadataGenerationStarted = true;
          console.log("\n=== OpenAI Metadata Generation Started ===");
        }

        // Verify OpenAI metadata response
        if (
          messageText.includes("Generated metadata") ||
          messageText.includes("Voyagers Beyond") || // Detectar el título generado
          (update.message?.parts[0].text &&
            update.message.parts[0].text.includes("{") &&
            update.message.parts[0].text.includes("title"))
        ) {
          openAIResponse = update;
          stages.metadataGenerated = true;
          console.log("\n=== OpenAI Metadata Response ===");
          console.log("Raw response:", update.message?.parts[0].text);

          const text = update.message?.parts[0].text || "";
          try {
            if (text.includes("{")) {
              const metadata = JSON.parse(text);
              console.log("Parsed metadata:", prettyPrint(metadata));

              // Verify metadata structure and content
              expect(metadata).toHaveProperty("title");
              expect(metadata).toHaveProperty("lyrics");
              expect(metadata.lyrics).toMatch(/(\[Verse|\[Chorus)/i);

              // Verify theme-specific content
              const lowerText = metadata.lyrics.toLowerCase();
              expect(lowerText).toMatch(
                /rock|space|stars|planets|cosmos|galaxy/
              );
            }
          } catch (e) {
            console.log("Not a JSON response, continuing...");
          }
        }

        // Track Suno audio generation
        if (messageText.includes("Generating audio")) {
          sunoResponse = update;
          stages.audioGenerationStarted = true;
          console.log("\n=== Suno Generation Started ===");
          console.log(prettyPrint(update));
        }

        // Track audio generation progress
        if (messageText.includes("%")) {
          stages.audioGenerationProgress = true;
          console.log("\n=== Suno Generation Progress ===");
          console.log(messageText);
        }

        // Verify final artifacts
        if (update.artifacts && update.artifacts.length > 0) {
          stages.audioGenerated = true;
          console.log("\n=== Final Song Generation Result ===");

          const artifact = update.artifacts[0];
          expect(artifact.parts).toHaveLength(2);

          // Verify audio part
          const audioPart = artifact.parts[0];
          expect(audioPart.type).toBe("audio");
          expect(audioPart.audioUrl).toBeDefined();

          // Verify metadata part
          const metadataPart = artifact.parts[1];
          expect(metadataPart.type).toBe("text");
          expect(metadataPart.text).toBeDefined();

          if (audioPart.audioUrl) {
            const isValidAudio = await validateAudioUrl(audioPart.audioUrl);
            expect(isValidAudio).toBe(true);
            console.log(
              "Audio URL is valid and accessible:",
              audioPart.audioUrl
            );
          }

          if (metadataPart.text) {
            const metadata = JSON.parse(metadataPart.text);
            console.log("Final Metadata:", prettyPrint(metadata));

            // Verify metadata structure
            expect(metadata).toHaveProperty("title");
            expect(metadata).toHaveProperty("lyrics");
            expect(metadata.lyrics).toMatch(/\[Verse|\[Chorus/);
          }
        }
      }

      // Final verifications
      expect(stages.metadataGenerationStarted).toBe(true);
      expect(stages.metadataGenerated).toBe(true);
      expect(stages.audioGenerationStarted).toBe(true);
      expect(stages.audioGenerationProgress).toBe(true);
      expect(stages.audioGenerated).toBe(true);
      expect(openAIResponse).toBeDefined();
      expect(sunoResponse).toBeDefined();

      const finalState = updates[updates.length - 1].state;
      expect(finalState).toBe(TaskState.COMPLETED);

      console.log("\n=== Test Summary ===");
      console.log("Process stages completed:", prettyPrint(stages));
      console.log("Final state:", finalState);
      console.log("Total updates received:", updates.length);
    } catch (error) {
      console.error("\n=== E2E Test Failed ===");
      console.error("Error:", error);
      console.error("Last update state:", updates[updates.length - 1]?.state);
      console.error(
        "Last update message:",
        updates[updates.length - 1]?.message?.parts[0].text
      );
      throw error;
    }
  });

  /**
   * @test
   * @description Should handle API errors gracefully
   */
  it("should handle API errors gracefully", async () => {
    const prompt = "Test error handling";
    const task = await a2aController.createTask(prompt);
    createdTaskIds.push(task.id);

    const invalidController = new SongGenerationController(
      "invalid-openai-key",
      "invalid-suno-key"
    );

    console.log(`Created error test task with ID: ${task.id}`);

    const context = {
      task,
      isCancelled: () => false,
    };

    const generator = invalidController.handleTask(context);
    const updates: TaskYieldUpdate[] = [];

    try {
      for await (const update of generator) {
        updates.push(update);
        console.log("\n=== Error Test Update ===");
        console.log("State:", update.state);
        console.log("Message:", update.message?.parts[0].text);
      }
    } catch (error) {
      const lastUpdate = updates[updates.length - 1];
      expect(lastUpdate.state).toBe(TaskState.FAILED);
      expect(lastUpdate.message?.parts[0].text).toMatch(/error|failed/i);
      console.log("\n=== Expected API Error ===");
      console.log("Error message:", lastUpdate.message?.parts[0].text);
      expect(lastUpdate.message?.parts[0].text).toContain("401");
    }
  });

  /**
   * @test
   * @description Should handle empty and short prompts correctly
   */
  it("should handle invalid prompts", async () => {
    const testCases = [{ prompt: "" }, { prompt: "short" }];

    for (const { prompt } of testCases) {
      const task = await a2aController.createTask(prompt);
      createdTaskIds.push(task.id);

      console.log(`Created invalid prompt test task with ID: ${task.id}`);

      const context = { task, isCancelled: () => false };
      const generator = controller.handleTask(context);
      const updates: TaskYieldUpdate[] = [];

      for await (const update of generator) {
        updates.push(update);
        console.log("\n=== Invalid Prompt Test Update ===");
        console.log("Task ID:", task.id);
        console.log("Prompt:", task.prompt);
        console.log("State:", update.state);
        console.log("Message:", update.message?.parts[0].text);
      }

      expect(updates[0].state).toBe(TaskState.INPUT_REQUIRED);
      expect(updates[0].message?.parts[0].text).toMatch(
        prompt === "" ? /provide a prompt/i : /more detailed/i
      );
    }
  });
});
