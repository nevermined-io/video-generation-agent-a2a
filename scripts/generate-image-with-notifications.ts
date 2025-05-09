/**
 * Script to generate an image using the Nevermined agent with SSE notifications (A2A JSON-RPC 2.0)
 * Hace una única petición POST a /tasks/sendSubscribe con notification.mode: 'sse',
 * y procesa los eventos SSE directamente de la respuesta.
 */

import { v4 as uuidv4 } from "uuid";
import http from "http";
import https from "https";
import { URL } from "url";

// Configuration
const CONFIG = {
  serverUrl: process.env.SERVER_URL || "http://localhost:8003",
  eventTypes: ["status_update", "completion"],
};

/**
 * Creates a new image generation task and processes SSE events from the same connection
 * @param {Object} params Image generation parameters
 * @param {string} params.prompt The prompt for the image
 * @param {string} [params.style] Optional style
 * @returns {Promise<void>}
 */
async function generateImageWithNotifications(params: {
  prompt: string;
  style?: string;
}): Promise<void> {
  // Build the message according to A2A
  const message = {
    role: "user",
    parts: [{ type: "text", text: params.prompt }],
  };
  const metadata: Record<string, any> = {};
  if (params.style) metadata.style = params.style;

  // JSON-RPC 2.0 request body with SSE notification
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
        mode: "sse",
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
      Accept: "text/event-stream",
    },
  };

  // Choose http or https module
  const client = isHttps ? https : http;

  // Make the POST request and process SSE events from the response
  await new Promise<void>((resolve, reject) => {
    const req = client.request(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Server responded with status ${res.statusCode}`));
        return;
      }
      res.setEncoding("utf8");
      let buffer = "";
      console.log("SSE connection established. Waiting for events...");
      res.on("data", (chunk) => {
        buffer += chunk;
        let eventEnd;
        while ((eventEnd = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);
          processSSEEvent(rawEvent);
        }
      });
      res.on("end", () => {
        console.log("SSE connection closed by server.");
        resolve();
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

/**
 * Parses and processes a single SSE event block
 * @param {string} rawEvent The raw SSE event string
 */
function processSSEEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  let eventType = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }
  if (data) {
    try {
      const parsed = JSON.parse(data);
      console.log(`[SSE][${eventType}]`, parsed);
      // Optionally, handle completion/error to exit early
      if (eventType === "completion" || eventType === "error") {
        console.log("Final event received. Exiting.");
        process.exit(0);
      }
    } catch (err) {
      console.error("Failed to parse SSE data:", data, err);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const prompt =
    process.argv[2] ||
    "A futuristic cityscape at sunset, highly detailed, digital art";
  generateImageWithNotifications({ prompt })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

export { generateImageWithNotifications };
