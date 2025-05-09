/**
 * Script to generate a video using the Nevermined agent with webhook notifications (A2A JSON-RPC 2.0)
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
  webhookPort: 4002,
  webhookPath: "/webhook-test-client-video",
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
        const videoArtifact = artifacts.find((artifact: any) =>
          artifact.parts?.some((part: any) => part.type === "video")
        );
        if (videoArtifact) {
          // 1. Buscar en part.url
          let videoUrl: string | undefined = undefined;
          const videoPart = videoArtifact.parts.find(
            (part: any) => part.type === "video" && part.url
          );
          if (videoPart) {
            videoUrl = videoPart.url;
          }
          // 2. Si no existe, buscar en part.text y verificar si parece una URL
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
          // 3. Si no existe, buscar en artifact.metadata.url
          if (
            !videoUrl &&
            (videoArtifact as any).metadata &&
            (videoArtifact as any).metadata.url
          ) {
            videoUrl = (videoArtifact as any).metadata.url;
          }
          const metadataPart = videoArtifact.parts.find(
            (part: any) => part.type === "text"
          );
          console.log("[Webhook Client] Video URL:", videoUrl);
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
 * Creates a new video generation task and registers webhook in a single call
 * @param {Object} params Video generation parameters
 * @param {string} params.prompt The prompt for the video
 * @param {number} [params.duration] Optional duration
 * @param {string[]} [params.imageUrls] Optional reference images
 * @param {string} webhookUrl The webhook URL
 * @returns {Promise<void>}
 */
async function generateVideoWithWebhook(
  params: {
    prompt: string;
    duration?: number;
    imageUrls?: string[];
  },
  webhookUrl: string
): Promise<void> {
  // Build the message according to A2A
  const message = {
    role: "user",
    parts: [{ type: "text", text: params.prompt }],
  };
  const metadata: Record<string, any> = {};
  if (params.imageUrls) metadata.imageUrls = params.imageUrls;
  if (params.duration) metadata.duration = params.duration;

  // JSON-RPC 2.0 request body with webhook notification
  const jsonRpcRequest = {
    jsonrpc: "2.0",
    id: uuidv4(),
    method: "tasks/sendSubscribe",
    params: {
      sessionId: uuidv4(),
      message,
      metadata,
      taskType: "text2video",
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
    process.argv[2] || "A timelapse of a city skyline, cinematic, 5 seconds";
  startWebhookServer().then((webhookUrl) =>
    generateVideoWithWebhook(
      {
        prompt,
        duration: 5,
        imageUrls: [
          "https://v3.fal.media/files/zebra/vKRttnrYOu5FuljgFxC7-.png",
          "https://v3.fal.media/files/monkey/mKJ72b67ckayIuX7Ql1pQ.png",
        ],
      },
      webhookUrl
    )
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

export { generateVideoWithWebhook };
