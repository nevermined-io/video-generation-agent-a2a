/**
 * @file taskMocks.ts
 * @description Mock data for task-related tests
 */

import { Task, TaskState } from "../../src/interfaces/a2a";

/**
 * @function createMockTask
 * @description Creates a mock task with the given parameters
 */
export const createMockTask = (
  id: string = "test-task-id",
  state: TaskState = TaskState.SUBMITTED
): Task => ({
  id,
  prompt: "Mock task prompt",
  sessionId: "test-session",
  status: {
    state,
    timestamp: new Date().toISOString(),
    message: {
      role: "agent" as const,
      parts: [
        {
          type: "text" as const,
          text: "Mock task message",
        },
      ],
    },
  },
  message: {
    role: "user" as const,
    parts: [
      {
        type: "text" as const,
        text: "User request",
      },
    ],
  },
});

/**
 * @const mockTaskRequest
 * @description Sample task request data for testing
 */
export const mockTaskRequest = {
  title: "Test Song",
  tags: ["test", "unit", "mock"],
  idea: "A song about testing and mocking",
  sessionId: "test-session",
};
