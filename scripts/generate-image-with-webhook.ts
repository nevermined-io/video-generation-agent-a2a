/**
 * Script to generate an image using the Nevermined agent with webhook notifications
 * Instead of SSE, it registers a webhook and receives notifications via HTTP POST
 * @todo Remove the express server after testing
 */

import axios, { AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";
import express from "express";
import bodyParser from "body-parser";
import { AddressInfo } from "net";

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || "http://localhost:8000",
  webhookPort: 4001,
  webhookPath: "/webhook-test-client",
  eventTypes: ["status_update", "completion"],
};

/**
 * Starts a temporary Express server to receive webhook notifications
 * @returns {Promise<string>} The webhook URL
 */
async function startWebhookServer(): Promise<string> {
  return new Promise((resolve) => {
    const app = express();
    app.use(bodyParser.json());

    app.post(CONFIG.webhookPath, (req, res) => {
      console.log(
        "[Webhook Client] Notification received:",
        JSON.stringify(req.body, null, 2)
      );
      // Buscar artifacts en todas las ubicaciones posibles
      const artifacts =
        req.body.artifacts ||
        req.body.data?.finalStatus?.artifacts ||
        req.body.data?.status?.artifacts;
      if (artifacts) {
        const imageArtifact = artifacts.find((artifact: any) =>
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
          // 2. If it doesn't exist, search in part.text and verify if it seems a URL
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
          // 3. If it doesn't exist, search in artifact.metadata.url
          if (
            !imageUrl &&
            (imageArtifact as any).metadata &&
            (imageArtifact as any).metadata.url
          ) {
            imageUrl = (imageArtifact as any).metadata.url;
          }
          const metadataPart = imageArtifact.parts.find(
            (part: any) => part.type === "text"
          );
          console.log("[Webhook Client] Image URL:", imageUrl);
          if (metadataPart?.text) {
            try {
              console.log(
                "[Webhook Client] Metadata:",
                JSON.parse(metadataPart.text)
              );
            } catch {
              console.log(
                "[Webhook Client] Metadata (raw):",
                metadataPart.text
              );
            }
          }
        }
      }
      res.status(200).send("OK");
    });

    const server = app.listen(CONFIG.webhookPort, () => {
      const address = server.address() as AddressInfo;
      const url = `http://localhost:${address.port}${CONFIG.webhookPath}`;
      console.log(`[Webhook Client] Listening for notifications at: ${url}`);
      resolve(url);
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
      method: "tasks/sendSubscribe",
      params: {
        message: {
          role: "user",
          parts: [{ type: "text", text: params.prompt }],
        },
        sessionId: uuidv4(),
        taskType: "text2image",
      },
    };
    console.log("Sending image task request (A2A JSON-RPC 2.0):", taskRequest);
    const response = await axios.post(
      `${CONFIG.serverUrl}/tasks/sendSubscribe`,
      taskRequest
    );
    console.log("Server response:", response.data);
    return response.data.result.id;
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("API Response:", error.response?.data);
      throw new Error(
        `Failed to create image generation task: ${error.message}`
      );
    }
    throw new Error("Failed to create image generation task: Unknown error");
  }
}

/**
 * Registers a webhook for receiving notifications for a task
 * @param {string} taskId The task ID
 * @param {string} webhookUrl The webhook URL
 * @returns {Promise<void>}
 */
async function registerWebhook(
  taskId: string,
  webhookUrl: string
): Promise<void> {
  try {
    const config = {
      taskId,
      eventTypes: CONFIG.eventTypes,
      webhookUrl,
    };
    console.log("Registering webhook:", config);
    const response = await axios.post(
      `${CONFIG.serverUrl}/tasks/${taskId}/notifications`,
      config
    );
    console.log("Webhook registration response:", response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error("Webhook registration error:", error.response?.data);
      throw new Error(`Failed to register webhook: ${error.message}`);
    }
    throw new Error("Failed to register webhook: Unknown error");
  }
}

/**
 * Main function to generate an image and receive webhook notifications
 * @param {Object} imageParams Parameters for image generation
 * @returns {Promise<void>}
 */
async function generateImageWithWebhook(imageParams: {
  prompt: string;
  style?: string;
}): Promise<void> {
  // Start webhook server
  const webhookUrl = await startWebhookServer();

  // Create task
  const taskId = await createImageTask(imageParams);
  console.log(`Task created with ID: ${taskId}`);

  // Register webhook
  await registerWebhook(taskId, webhookUrl);

  console.log("Waiting for webhook notifications... (press Ctrl+C to exit)");
}

// Run the script if called directly
if (require.main === module) {
  const prompt =
    process.argv[2] ||
    "A futuristic cityscape at sunset, highly detailed, digital art";
  generateImageWithWebhook({ prompt })
    .then(() => {})
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

export { generateImageWithWebhook };
