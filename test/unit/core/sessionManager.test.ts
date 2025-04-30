/**
 * @file sessionManager.test.ts
 * @description Unit tests for SessionManager class
 */

import { SessionManager } from "../../../src/core/sessionManager";

describe("SessionManager", () => {
  let sessionManager: SessionManager;
  const testSessionId = "test-session-1";
  const testData = {
    userId: "user123",
    preferences: { theme: "dark" },
  };

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe("Session Creation", () => {
    test("should create a new session with ID and data", () => {
      sessionManager.createSession(testSessionId, testData);
      const session = sessionManager.getSession(testSessionId);

      expect(session).toBeDefined();
      expect(session.id).toBe(testSessionId);
      expect(session.userId).toBe(testData.userId);
      expect(session.preferences).toEqual(testData.preferences);
      expect(session.createdAt).toBeDefined();
    });

    test("should create a session with only ID if no data provided", () => {
      sessionManager.createSession(testSessionId);
      const session = sessionManager.getSession(testSessionId);

      expect(session).toBeDefined();
      expect(session.id).toBe(testSessionId);
      expect(session.createdAt).toBeDefined();
    });
  });

  describe("Session Retrieval", () => {
    beforeEach(() => {
      sessionManager.createSession(testSessionId, testData);
    });

    test("should return undefined for non-existent session", () => {
      const session = sessionManager.getSession("non-existent");
      expect(session).toBeUndefined();
    });

    test("should retrieve existing session with all data", () => {
      const session = sessionManager.getSession(testSessionId);
      expect(session).toBeDefined();
      expect(session.id).toBe(testSessionId);
      expect(session.userId).toBe(testData.userId);
    });
  });

  describe("Session Updates", () => {
    beforeEach(() => {
      sessionManager.createSession(testSessionId, testData);
    });

    test("should update existing session data", () => {
      const updateData = {
        preferences: { theme: "light" },
      };

      sessionManager.updateSession(testSessionId, updateData);
      const session = sessionManager.getSession(testSessionId);

      expect(session.preferences.theme).toBe("light");
      expect(session.userId).toBe(testData.userId); // Original data preserved
    });

    test("should not throw error when updating non-existent session", () => {
      expect(() => {
        sessionManager.updateSession("non-existent", { data: "test" });
      }).not.toThrow();
    });
  });

  describe("Session Deletion", () => {
    beforeEach(() => {
      sessionManager.createSession(testSessionId, testData);
    });

    test("should delete existing session", () => {
      const result = sessionManager.deleteSession(testSessionId);
      expect(result).toBe(true);
      expect(sessionManager.getSession(testSessionId)).toBeUndefined();
    });

    test("should return false when deleting non-existent session", () => {
      const result = sessionManager.deleteSession("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("Session Listing", () => {
    beforeEach(() => {
      sessionManager.createSession("session1", { data: 1 });
      sessionManager.createSession("session2", { data: 2 });
    });

    test("should list all sessions", () => {
      const sessions = sessionManager.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain("session1");
      expect(sessions.map((s) => s.id)).toContain("session2");
    });

    test("should return empty array when no sessions exist", () => {
      const emptyManager = new SessionManager();
      const sessions = emptyManager.listSessions();
      expect(sessions).toHaveLength(0);
    });
  });
});
