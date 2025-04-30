/**
 * Script to generate a song using the Nevermined agent with SSE notifications
 * Instead of polling, it subscribes to server events to get real-time updates
 * about the song generation progress
 */

import axios, { AxiosError } from "axios";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { EventSource, MessageEvent, ErrorEvent } from "undici";

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || "http://localhost:8000",
  maxConnectionAttempts: 5,
  reconnectDelay: 1000, // 1 second
};

// Types for SSE messages
interface TaskNotification {
  data: {
    status?: string;
    progress?: number;
    error?: string;
    parts?: Array<{
      type: string;
      text?: string;
      audioUrl?: string;
    }>;
    artifacts?: Array<{
      parts: Array<{
        type: string;
        text?: string;
        audioUrl?: string;
      }>;
    }>;
    result?: any;
  };
}

/**
 * Checks if the server is running by making a health check request
 * @returns {Promise<boolean>} True if server is running, false otherwise
 */
async function isServerRunning(): Promise<boolean> {
  try {
    console.log(`Checking server health at: ${CONFIG.serverUrl}/health`);
    const response = await axios.get(`${CONFIG.serverUrl}/health`);
    console.log("Server response:", response.status, response.data);
    return response.status === 200;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Server connection error:", {
        message: error.message,
        code: error.code,
        response: error.response?.data,
      });
    } else {
      console.error("Unknown error:", error);
    }
    return false;
  }
}

/**
 * Starts the server using npm run start
 * @returns {Promise<void>}
 * @throws {Error} If server fails to start within timeout
 */
async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Starting server...");
    const serverProcess = spawn("npm", ["run", "start"], {
      stdio: "inherit",
      shell: true,
    });

    let startTimeout: NodeJS.Timeout;
    let checkInterval: NodeJS.Timeout;

    startTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      serverProcess.kill();
      reject(new Error("Server failed to start within 30 seconds timeout"));
    }, 30000);

    checkInterval = setInterval(async () => {
      try {
        if (await isServerRunning()) {
          clearTimeout(startTimeout);
          clearInterval(checkInterval);
          resolve();
        }
      } catch (error) {
        console.log("Waiting for server to be ready...");
      }
    }, 1000);

    serverProcess.on("error", (error) => {
      clearTimeout(startTimeout);
      clearInterval(checkInterval);
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(startTimeout);
        clearInterval(checkInterval);
        reject(new Error(`Server process exited with code ${code}`));
      }
    });
  });
}

/**
 * Creates a new song generation task and sets up push notifications
 * @param {Object} params Song generation parameters
 * @returns {Promise<string>} Task ID
 */
async function createSongTask(params: {
  prompt: string;
  style?: string;
  duration?: number;
}): Promise<string> {
  try {
    const taskRequest = {
      prompt: params.prompt,
      sessionId: uuidv4(),
    };

    console.log("Sending task request:", taskRequest);
    const response = await axios.post(
      `${CONFIG.serverUrl}/tasks/sendSubscribe`,
      taskRequest
    );
    console.log("Server response:", response.data);

    // Configure push notifications for this task
    await axios.post(
      `${CONFIG.serverUrl}/tasks/${response.data.id}/notifications`,
      {
        eventTypes: ["STATUS_UPDATE", "PROGRESS_UPDATE", "ERROR"],
      }
    );

    return response.data.id;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("API Response:", error.response?.data);
      throw new Error(
        `Failed to create song generation task: ${error.message}`
      );
    }
    throw new Error("Failed to create song generation task: Unknown error");
  }
}

/**
 * Subscribes to task updates using Server-Sent Events
 * @param {string} taskId The task ID to subscribe to
 * @returns {Promise<any>} Returns a promise that resolves with the final task result
 */
function subscribeToTaskUpdates(taskId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let lastProgress = 0;
    let lastMessage = "";
    let reconnectAttempts = 0;

    function connect() {
      const eventSource = new EventSource(
        `${CONFIG.serverUrl}/tasks/${taskId}/notifications`
      );

      eventSource.onopen = () => {
        console.log("SSE connection established");
      };

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data) as TaskNotification;

          // Handle progress updates
          if (message.data?.progress && message.data.progress > lastProgress) {
            lastProgress = message.data.progress;
            console.log(`Progress: ${message.data.progress}%`);
          }

          // Handle message updates
          if (message.data?.parts) {
            const currentMessage = message.data.parts
              .filter((part: any) => part.type === "text")
              .map((part: any) => part.text)
              .join("\n");

            if (currentMessage && currentMessage !== lastMessage) {
              console.log(`Update: ${currentMessage}`);
              lastMessage = currentMessage;
            }
          }

          // Handle task completion
          if (message.data?.status === "completed") {
            console.log("Song generation completed successfully!");

            const audioArtifact = message.data.artifacts?.find(
              (artifact: any) =>
                artifact.parts?.some((part: any) => part.type === "audio")
            );

            eventSource.close();
            if (audioArtifact) {
              const audioPart = audioArtifact.parts.find(
                (part: any) => part.type === "audio"
              );
              const metadataPart = audioArtifact.parts.find(
                (part: any) => part.type === "text"
              );

              resolve({
                status: "completed",
                audioUrl: audioPart?.audioUrl,
                metadata: metadataPart?.text
                  ? JSON.parse(metadataPart.text)
                  : null,
                artifacts: message.data.artifacts,
              });
            } else {
              resolve(message.data.result);
            }
          } else if (message.data?.status === "failed") {
            eventSource.close();
            reject(new Error(`Song generation failed: ${message.data.error}`));
          } else if (message.data?.status === "cancelled") {
            eventSource.close();
            reject(new Error("Song generation was cancelled"));
          }
        } catch (error) {
          console.error("Error processing SSE message:", error);
        }
      };

      eventSource.onerror = (error: ErrorEvent) => {
        console.error("SSE error:", error);
        eventSource.close();

        if (reconnectAttempts < CONFIG.maxConnectionAttempts) {
          reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${reconnectAttempts}/${CONFIG.maxConnectionAttempts})...`
          );
          setTimeout(connect, CONFIG.reconnectDelay);
        } else {
          reject(new Error("Failed to maintain SSE connection"));
        }
      };
    }

    connect();
  });
}

/**
 * Main function to generate a song using SSE notifications
 * @param {Object} songParams Parameters for song generation
 * @returns {Promise<any>} Generated song data or error
 */
async function generateSongWithNotifications(songParams: {
  prompt: string;
  style?: string;
  duration?: number;
}): Promise<any> {
  try {
    // Check if server is running
    const isRunning = await isServerRunning();
    if (!isRunning) {
      await startServer();
    }

    // Create task
    console.log("Creating song generation task...");
    const taskId = await createSongTask(songParams);
    console.log(`Task created with ID: ${taskId}`);

    // Subscribe to task updates via SSE
    return await subscribeToTaskUpdates(taskId);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error generating song:", error.message);
      throw error;
    }
    throw new Error("Unknown error occurred while generating song");
  }
}

// Example usage
if (require.main === module) {
  const songParams = {
    prompt: "Create a happy pop song about summer",
    style: "pop",
    duration: 180, // 3 minutes
  };

  generateSongWithNotifications(songParams)
    .then((result) => {
      console.log("Generated song:", result);
    })
    .catch((error) => {
      console.error("Failed to generate song:", error.message);
      process.exit(1);
    });
}

export { generateSongWithNotifications, isServerRunning, startServer };
