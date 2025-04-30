/**
 * @file pushNotificationService.test.ts
 * @description Unit tests for the PushNotificationService
 */

import { Response } from "express";
import { PushNotificationService } from "../../../src/services/pushNotificationService";
import {
  PushNotificationConfig,
  PushNotificationEvent,
  PushNotificationEventType,
} from "../../../src/interfaces/a2a";

describe("PushNotificationService", () => {
  let service: PushNotificationService;
  let mockResponse: Partial<Response>;
  let mockConfig: PushNotificationConfig;

  beforeEach(() => {
    service = new PushNotificationService();

    // Mock response object
    mockResponse = {
      writeHead: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
    };

    // Mock config
    mockConfig = {
      taskId: "test-task-id",
      eventTypes: [
        PushNotificationEventType.STATUS_UPDATE,
        PushNotificationEventType.COMPLETION,
      ],
    };
  });

  describe("subscribe", () => {
    it("should set up SSE headers correctly", () => {
      service.subscribe("test-task-id", mockResponse as Response, mockConfig);

      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    });

    it("should send initial connection event", () => {
      service.subscribe("test-task-id", mockResponse as Response, mockConfig);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status_update"')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"status":"connected"')
      );
    });

    it("should set up disconnect handler", () => {
      service.subscribe("test-task-id", mockResponse as Response, mockConfig);

      expect(mockResponse.on).toHaveBeenCalledWith(
        "close",
        expect.any(Function)
      );
    });
  });

  describe("notify", () => {
    it("should send notifications to subscribed clients", () => {
      // Subscribe a client
      service.subscribe("test-task-id", mockResponse as Response, mockConfig);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Create a test event
      const event: PushNotificationEvent = {
        type: PushNotificationEventType.STATUS_UPDATE,
        taskId: "test-task-id",
        timestamp: new Date().toISOString(),
        data: { status: "working" },
      };

      // Send notification
      service.notify("test-task-id", event);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"status_update"')
      );
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"status":"working"')
      );
    });

    it("should not send notifications for unsubscribed event types", () => {
      // Subscribe to only completion events
      const limitedConfig: PushNotificationConfig = {
        taskId: "test-task-id",
        eventTypes: [PushNotificationEventType.COMPLETION],
      };

      service.subscribe(
        "test-task-id",
        mockResponse as Response,
        limitedConfig
      );

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      // Create a status update event
      const event: PushNotificationEvent = {
        type: PushNotificationEventType.STATUS_UPDATE,
        taskId: "test-task-id",
        timestamp: new Date().toISOString(),
        data: { status: "working" },
      };

      // Send notification
      service.notify("test-task-id", event);

      // Should not have sent any notifications since we're not subscribed to STATUS_UPDATE
      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it("should handle webhook notifications", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const configWithWebhook: PushNotificationConfig = {
        ...mockConfig,
        webhookUrl: "http://test-webhook.com",
      };

      service.subscribe(
        "test-task-id",
        mockResponse as Response,
        configWithWebhook
      );

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      const event: PushNotificationEvent = {
        type: PushNotificationEventType.STATUS_UPDATE,
        taskId: "test-task-id",
        timestamp: new Date().toISOString(),
        data: { status: "working" },
      };

      service.notify("test-task-id", event);

      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-webhook.com",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        })
      );
    });
  });

  describe("unsubscribe", () => {
    it("should remove client from connections", () => {
      service.subscribe("test-task-id", mockResponse as Response, mockConfig);

      // Clear the mock calls from the initial connection message
      (mockResponse.write as jest.Mock).mockClear();

      service.unsubscribe("test-task-id", mockResponse as Response);

      // Send a notification after unsubscribe
      const event: PushNotificationEvent = {
        type: PushNotificationEventType.STATUS_UPDATE,
        taskId: "test-task-id",
        timestamp: new Date().toISOString(),
        data: { status: "working" },
      };

      service.notify("test-task-id", event);

      // Should not have received any notifications after unsubscribe
      expect(mockResponse.write).not.toHaveBeenCalled();
    });
  });
});
