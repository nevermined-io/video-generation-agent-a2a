/**
 * Script to generate an image using the Nevermined agent with webhook notifications (A2A JSON-RPC 2.0)
 * Hace una única petición POST a /tasks/sendSubscribe con notification.mode: 'webhook' y notification.url.
 */

import { v4 as uuidv4 } from "uuid";
import express from "express";
import bodyParser from "body-parser";
import { AddressInfo } from "net";
import http from "http";
import https from "https";
import { URL } from "url";

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || "http://localhost:8003",
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
 * Creates a new image generation task and registers webhook in a single call
 * @param {Object} params Image generation parameters
 * @param {string} params.prompt The prompt for the image
 * @param {string} [params.style] Optional style
 * @param {string} webhookUrl The webhook URL
 * @returns {Promise<void>}
 */
async function generateImageWithWebhook(
  params: {
    prompt: string;
    style?: string;
  },
  webhookUrl: string
): Promise<void> {
  // Build the message according to A2A
  const message = {
    role: "user",
    parts: [{ type: "text", text: params.prompt }],
  };
  const metadata: Record<string, any> = {};
  if (params.style) metadata.style = params.style;

  // JSON-RPC 2.0 request body with webhook notification
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: uuidv4(),
    method: "tasks/sendSubscribe",
    params: {
      sessionId: uuidv4(),
      message,
      metadata,
      taskType: "text2image",
      notification: {
        mode: "webhook",
        url: webhookUrl,
        eventTypes: CONFIG.eventTypes,
      },
    },
  };

  // Prepare HTTP(S) request options
  const url = new URL("/tasks/sendSubscribe", CONFIG.serverUrl);
  const isHttps = url.protocol === "https:";
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  // Choose http or https module
  const client = isHttps ? https : http;

  // Make the POST request
  await new Promise<void>((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("[Webhook Client] Task creation response:", parsed);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      res.on("error", (err) => {
        reject(err);
      });
    });
    req.on("error", (err) => {
      reject(err);
    });
    req.write(JSON.stringify(jsonRpcRequest));
    req.end();
  });
}

// Run the script if called directly
if (require.main === module) {
  const prompt =
    process.argv[2] ||
    "A futuristic cityscape at sunset, highly detailed, digital art";
  startWebhookServer().then((webhookUrl) =>
    generateImageWithWebhook({ prompt }, webhookUrl)
      .then(() => {
        console.log(
          "Waiting for webhook notifications... (press Ctrl+C to exit)"
        );
      })
      .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
      })
  );
}

export { generateImageWithWebhook };
