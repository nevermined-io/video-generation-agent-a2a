/**
 * @file pushNotificationService.ts
 * @description Service for handling push notifications using Server-Sent Events (SSE)
 */

import { Response } from "express";
import { Logger } from "../utils/logger";
import {
  PushNotificationConfig,
  PushNotificationEvent,
  PushNotificationEventType,
} from "../interfaces/a2a";

/**
 * @class PushNotificationService
 * @description Manages SSE connections and push notifications
 */
export class PushNotificationService {
  private connections: Map<string, Set<Response>>;
  private subscriptions: Map<string, PushNotificationConfig>;

  constructor() {
    this.connections = new Map();
    this.subscriptions = new Map();
  }

  /**
   * @method subscribe
   * @description Subscribe a client to push notifications for a task
   * @param {string} taskId - The task ID to subscribe to
   * @param {Response} res - The Express response object for SSE
   * @param {PushNotificationConfig} config - Notification configuration
   */
  public subscribe(
    taskId: string,
    res: Response,
    config: PushNotificationConfig
  ): void {
    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Initialize connection set for this task if it doesn't exist
    if (!this.connections.has(taskId)) {
      this.connections.set(taskId, new Set());
    }

    // Add this connection to the set
    this.connections.get(taskId)?.add(res);

    // Store subscription config
    this.subscriptions.set(taskId, config);

    // Send initial connection confirmation
    this.sendEventToClient(res, {
      type: PushNotificationEventType.STATUS_UPDATE,
      taskId,
      timestamp: new Date().toISOString(),
      data: { status: "connected" },
    });

    Logger.info(`Client subscribed to notifications for task ${taskId}`);

    // Handle client disconnect
    res.on("close", () => {
      this.unsubscribe(taskId, res);
    });
  }

  /**
   * @method unsubscribe
   * @description Unsubscribe a client from push notifications
   * @param {string} taskId - The task ID to unsubscribe from
   * @param {Response} res - The Express response object
   */
  public unsubscribe(taskId: string, res: Response): void {
    const connections = this.connections.get(taskId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.connections.delete(taskId);
        this.subscriptions.delete(taskId);
      }
    }
    Logger.info(`Client unsubscribed from notifications for task ${taskId}`);
  }

  /**
   * @method notify
   * @description Send a notification to all subscribed clients for a task
   * @param {string} taskId - The task ID
   * @param {PushNotificationEvent} event - The event to send
   */
  public notify(taskId: string, event: PushNotificationEvent): void {
    const connections = this.connections.get(taskId);
    const config = this.subscriptions.get(taskId);

    if (!connections || !config) {
      return;
    }

    // Only send if client is subscribed to this event type
    if (config.eventTypes.includes(event.type)) {
      connections.forEach((res) => {
        this.sendEventToClient(res, event);
      });

      // If webhook URL is configured, send notification there too
      if (config.webhookUrl) {
        this.sendWebhookNotification(config.webhookUrl, event);
      }
    }
  }

  /**
   * @private
   * @method sendEventToClient
   * @description Send an SSE event to a client
   * @param {Response} res - The Express response object
   * @param {PushNotificationEvent} event - The event to send
   */
  private sendEventToClient(res: Response, event: PushNotificationEvent): void {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      Logger.error(`Error sending event to client: ${error}`);
      this.unsubscribe(event.taskId, res);
    }
  }

  /**
   * @private
   * @method sendWebhookNotification
   * @description Send a notification to a webhook URL
   * @param {string} webhookUrl - The webhook URL
   * @param {PushNotificationEvent} event - The event to send
   */
  private async sendWebhookNotification(
    webhookUrl: string,
    event: PushNotificationEvent
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      Logger.error(`Error sending webhook notification: ${error}`);
    }
  }
}
