/**
 * Script to generate an image using the Nevermined agent
 * It checks if the server is running, starts it if needed,
 * creates an image generation task and polls for its completion
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
 * Creates a new image generation task
 * @param {Object} params Image generation parameters
 * @returns {Promise<string>} Task ID
 */
async function createImageTask(params: {
  prompt: string;
  style?: string;
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
        taskType: "text2image",
        // Puedes añadir más parámetros aquí si lo deseas
      },
    };
    console.log("Sending image task request (A2A JSON-RPC 2.0):", taskRequest);
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
        `Failed to create image generation task: ${error.message}`
      );
    }
    throw new Error("Failed to create image generation task: Unknown error");
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
 * Main function to generate an image
 * @param {Object} imageParams Parameters for image generation
 * @returns {Promise<any>} Generated image data or error
 */
async function generateImage(imageParams: {
  prompt: string;
  style?: string;
}): Promise<any> {
  try {
    // Check if server is running
    const isRunning = await isServerRunning();
    if (!isRunning) {
      await startServer();
    }

    // Create task
    console.log("Creating image generation task...");
    const taskId = await createImageTask(imageParams);
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
        console.log("Image generation completed successfully!");

        // Search for the image artifact
        const imageArtifact = status.artifacts?.find((artifact: any) =>
          artifact.parts?.some((part: any) => part.type === "image")
        );

        if (imageArtifact) {
          // 1. Search in part.url
          let imageUrl: string | undefined = undefined;
          const imagePart = imageArtifact.parts.find(
            (part: any) => part.type === "image" && part.url
          );
          if (imagePart) {
            imageUrl = imagePart.url;
          }
          // 2. If not found, search in part.text and verify if it seems a URL
          if (!imageUrl) {
            const imageTextPart = imageArtifact.parts.find(
              (part: any) =>
                part.type === "image" &&
                typeof part.text === "string" &&
                part.text.startsWith("http")
            );
            if (imageTextPart) {
              imageUrl = imageTextPart.text;
            }
          }
          // 3. If not found, search in artifact.metadata.url
          if (
            !imageUrl &&
            imageArtifact.metadata &&
            imageArtifact.metadata.url
          ) {
            imageUrl = imageArtifact.metadata.url;
          }
          // 4. Extract metadata if exists
          const metadataPart = imageArtifact.parts.find(
            (part: any) => part.type === "text"
          );

          return {
            status: "completed",
            imageUrl,
            metadata: metadataPart?.text ? JSON.parse(metadataPart.text) : null,
            artifacts: status.artifacts,
          };
        }
        return status.result;
      } else if (status.status === "failed") {
        throw new Error(`Image generation failed: ${status.error}`);
      } else if (status.status === "cancelled") {
        throw new Error("Image generation was cancelled");
      }

      console.log(`Task status: ${status.status}. Waiting...`);
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.pollingInterval)
      );
      retries++;
    }

    throw new Error("Timeout waiting for image generation");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error generating image:", error.message);
      throw error;
    }
    throw new Error("Unknown error occurred while generating image");
  }
}

// Example usage
if (require.main === module) {
  const imageParams = {
    prompt: "A futuristic cityscape at sunset, highly detailed, digital art",
    style: "digital art",
  };

  generateImage(imageParams)
    .then((result) => {
      console.log("Generated image:", result);
    })
    .catch((error) => {
      console.error("Failed to generate image:", error.message);
      process.exit(1);
    });
}

export { generateImage, isServerRunning, startServer };
