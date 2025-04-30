/**
 * @file streamingService.ts
 * @description Service for handling real-time streaming events using Server-Sent Events (SSE)
 */

import { Response } from "express";
import { Logger } from "../utils/logger";
import { Task, TaskState, TaskArtifact } from "../interfaces/a2a";

/**
 * @interface StreamingConnection
 * @description Represents a streaming connection with its configuration
 */
interface StreamingConnection {
  response: Response;
  taskId: string;
}

/**
 * @class StreamingService
 * @description Manages SSE connections and streaming events for real-time task updates
 */
export class StreamingService {
  private connections: Map<string, Set<StreamingConnection>>;

  /**
   * @constructor
   */
  constructor() {
    this.connections = new Map();
  }

  /**
   * @method subscribe
   * @description Subscribe a client to streaming events for a task
   * @param {string} taskId - The task ID to subscribe to
   * @param {Response} res - The Express response object for SSE
   */
  public subscribe(taskId: string, res: Response): void {
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

    // Create new streaming connection
    const connection: StreamingConnection = {
      response: res,
      taskId,
    };

    // Add this connection to the set
    this.connections.get(taskId)?.add(connection);

    // Send initial connection confirmation
    this.sendEventToClient(connection, {
      id: taskId,
      status: {
        state: TaskState.SUBMITTED,
        timestamp: new Date().toISOString(),
      },
      final: false,
    });

    Logger.info(`Client subscribed to streaming events for task ${taskId}`);

    // Handle client disconnect
    res.on("close", () => {
      this.unsubscribe(taskId, res);
    });
  }

  /**
   * @method unsubscribe
   * @description Unsubscribe a client from streaming events
   * @param {string} taskId - The task ID
   * @param {Response} res - The Express response object
   */
  public unsubscribe(taskId: string, res: Response): void {
    const connections = this.connections.get(taskId);
    if (connections) {
      connections.forEach((conn) => {
        if (conn.response === res) {
          connections.delete(conn);
          Logger.info(
            `Client unsubscribed from streaming events for task ${taskId}`
          );
        }
      });

      // Remove the task entry if no more connections
      if (connections.size === 0) {
        this.connections.delete(taskId);
      }
    }
  }

  /**
   * @method notifyTaskUpdate
   * @description Send a task update to all subscribed clients
   * @param {Task} task - The updated task
   */
  public notifyTaskUpdate(task: Task): void {
    const connections = this.connections.get(task.id);
    if (!connections) return;

    const event = {
      id: task.id,
      status: task.status,
      final: this.isTaskInFinalState(task.status.state),
    };

    connections.forEach((connection) => {
      this.sendEventToClient(connection, event);
    });

    // Send artifacts if available
    if (task.artifacts?.length) {
      this.sendArtifacts(task.id, task.artifacts);
    }
  }

  /**
   * @private
   * @method sendArtifacts
   * @description Send artifacts to all subscribed clients for a task
   * @param {string} taskId - The task ID
   * @param {TaskArtifact[]} artifacts - The artifacts to send
   */
  private sendArtifacts(taskId: string, artifacts: TaskArtifact[]): void {
    const connections = this.connections.get(taskId);
    if (!connections) return;

    artifacts.forEach((artifact) => {
      const artifactEvent = {
        id: taskId,
        artifact: {
          parts: artifact.parts,
          index: artifact.index,
          append: false,
        },
      };

      connections.forEach((connection) => {
        this.sendEventToClient(connection, artifactEvent);
      });
    });
  }

  /**
   * @private
   * @method sendEventToClient
   * @description Send an SSE event to a client
   * @param {StreamingConnection} connection - The streaming connection
   * @param {any} event - The event data to send
   */
  private sendEventToClient(connection: StreamingConnection, event: any): void {
    try {
      connection.response.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      Logger.error(`Error sending event to client: ${error}`);
      this.unsubscribe(connection.taskId, connection.response);
    }
  }

  /**
   * @private
   * @method isTaskInFinalState
   * @description Check if a task is in a final state
   * @param {TaskState} state - The task state to check
   * @returns {boolean} Whether the task is in a final state
   */
  private isTaskInFinalState(state: TaskState): boolean {
    return [
      TaskState.COMPLETED,
      TaskState.CANCELLED,
      TaskState.FAILED,
    ].includes(state);
  }
}
