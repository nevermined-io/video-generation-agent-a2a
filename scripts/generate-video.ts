/**
 * Script to generate a video using the Nevermined agent
 * It checks if the server is running, starts it if needed,
 * creates a video generation task and polls for its completion
 */

import axios, { AxiosError } from "axios";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || "http://localhost:8000",
  pollingInterval: 5000, // 5 seconds
  maxRetries: 60, // 5 minutes maximum waiting time
};

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
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        },
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

    // Set a timeout of 30 seconds for server to start
    startTimeout = setTimeout(() => {
      clearInterval(checkInterval);
      serverProcess.kill();
      reject(new Error("Server failed to start within 30 seconds timeout"));
    }, 30000);

    // Wait for server to be ready
    checkInterval = setInterval(async () => {
      try {
        if (await isServerRunning()) {
          clearTimeout(startTimeout);
          clearInterval(checkInterval);
          resolve();
        }
      } catch (error) {
        // If checking server status fails, log but continue waiting
        console.log("Waiting for server to be ready...");
      }
    }, 1000);

    // Handle server process errors
    serverProcess.on("error", (error) => {
      clearTimeout(startTimeout);
      clearInterval(checkInterval);
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Handle server process exit
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
 * Creates a new video generation task
 * @param {Object} params Video generation parameters
 * @returns {Promise<string>} Task ID
 */
async function createVideoTask(params: {
  prompt: string;
  duration?: number;
  imageUrls?: string[];
}): Promise<string> {
  try {
    const requestId = uuidv4();
    const taskRequest = {
      jsonrpc: "2.0",
      id: requestId,
      method: "tasks/send",
      params: {
        message: {
          role: "user",
          parts: [{ type: "text", text: params.prompt }],
        },
        sessionId: uuidv4(),
        taskType: "text2video",
        duration: params.duration,
        imageUrls: params.imageUrls,
      },
    };
    console.log("Sending video task request (A2A JSON-RPC 2.0):", taskRequest);
    const response = await axios.post(
      `${CONFIG.serverUrl}/tasks/send`,
      taskRequest
    );
    console.log("Server response:", response.data);
    return response.data.result.id;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("API Response:", error.response?.data);
      console.error("Request that failed:", {
        url: error.config?.url,
        data: error.config?.data,
        headers: error.config?.headers,
      });
      throw new Error(
        `Failed to create video generation task: ${error.message}`
      );
    }
    throw new Error("Failed to create video generation task: Unknown error");
  }
}

/**
 * Checks the status of a task
 * @param {string} taskId The task ID to check
 * @returns {Promise<any>} Task status and result
 */
async function checkTaskStatus(taskId: string): Promise<any> {
  try {
    const response = await axios.get(`${CONFIG.serverUrl}/tasks/${taskId}`);
    return {
      status: response.data.status.state,
      result: response.data.status.message,
      error: response.data.status.error,
      progress: response.data.status.progress || 0,
      parts: response.data.status.message?.parts || [],
      artifacts: response.data.status.artifacts || [],
      history: response.data.status.history || [],
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("API Response:", error.response?.data);
      throw new Error(`Failed to check task status: ${error.message}`);
    }
    throw new Error("Failed to check task status: Unknown error");
  }
}

/**
 * Main function to generate a video
 * @param {Object} videoParams Parameters for video generation
 * @returns {Promise<any>} Generated video data or error
 */
async function generateVideo(videoParams: {
  prompt: string;
  duration?: number;
  imageUrls?: string[];
}): Promise<any> {
  try {
    // Check if server is running
    const isRunning = await isServerRunning();
    if (!isRunning) {
      await startServer();
    }

    // Create task
    console.log("Creating video generation task...");
    const taskId = await createVideoTask(videoParams);
    console.log(`Task created with ID: ${taskId}`);

    // Poll for completion
    let retries = 0;
    let lastProgress = 0;
    let lastMessage = "";

    while (retries < CONFIG.maxRetries) {
      const status = await checkTaskStatus(taskId);

      // Handle progress updates
      if (status.progress > lastProgress) {
        lastProgress = status.progress;
        console.log(`Progress: ${status.progress}%`);
      }

      // Handle message updates
      const currentMessage = status.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("\n");

      if (currentMessage && currentMessage !== lastMessage) {
        console.log(`Update: ${currentMessage}`);
        lastMessage = currentMessage;
      }

      // Check final states
      if (status.status === "completed") {
        console.log("Video generation completed successfully!");

        // Search for the video artifact
        const videoArtifact = status.artifacts?.find((artifact: any) =>
          artifact.parts?.some((part: any) => part.type === "video")
        );

        if (videoArtifact) {
          // 1. Search in part.url
          let videoUrl: string | undefined = undefined;
          const videoPart = videoArtifact.parts.find(
            (part: any) => part.type === "video" && part.url
          );
          if (videoPart) {
            videoUrl = videoPart.url;
          }
          // 2. If not found, search in part.text and verify if it seems a URL
          if (!videoUrl) {
            const videoTextPart = videoArtifact.parts.find(
              (part: any) =>
                part.type === "video" &&
                typeof part.text === "string" &&
                part.text.startsWith("http")
            );
            if (videoTextPart) {
              videoUrl = videoTextPart.text;
            }
          }
          // 3. If not found, search in artifact.metadata.url
          if (
            !videoUrl &&
            videoArtifact.metadata &&
            videoArtifact.metadata.url
          ) {
            videoUrl = videoArtifact.metadata.url;
          }
          // 4. Extract metadata if exists
          const metadataPart = videoArtifact.parts.find(
            (part: any) => part.type === "text"
          );

          return {
            status: "completed",
            videoUrl,
            metadata: metadataPart?.text ? JSON.parse(metadataPart.text) : null,
            artifacts: status.artifacts,
          };
        }
        return status.result;
      } else if (status.status === "failed") {
        throw new Error(`Video generation failed: ${status.error}`);
      } else if (status.status === "cancelled") {
        throw new Error("Video generation was cancelled");
      }

      console.log(`Task status: ${status.status}. Waiting...`);
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.pollingInterval)
      );
      retries++;
    }

    throw new Error("Timeout waiting for video generation");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error generating video:", error.message);
      throw error;
    }
    throw new Error("Unknown error occurred while generating video");
  }
}

// Example usage
if (require.main === module) {
  const videoParams = {
    prompt: "A timelapse of a city skyline, cinematic, 5 seconds",
    duration: 5,
    imageUrls: [
      "https://v3.fal.media/files/zebra/vKRttnrYOu5FuljgFxC7-.png",
      "https://v3.fal.media/files/monkey/mKJ72b67ckayIuX7Ql1pQ.png",
    ],
  };

  generateVideo(videoParams)
    .then((result) => {
      console.log("Generated video:", result);
    })
    .catch((error) => {
      console.error("Failed to generate video:", error.message);
      process.exit(1);
    });
}

export { generateVideo, isServerRunning, startServer };
