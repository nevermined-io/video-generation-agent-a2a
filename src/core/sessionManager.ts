/**
 * @file sessionManager.ts
 * @description Session management functionality
 */

/**
 * @class SessionManager
 * @description Manages user sessions and their state
 */
export class SessionManager {
  private sessions: Map<string, any>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * @method createSession
   * @description Create a new session
   */
  public createSession(sessionId: string, data: any = {}): void {
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * @method getSession
   * @description Get session by ID
   */
  public getSession(sessionId: string): any {
    return this.sessions.get(sessionId);
  }

  /**
   * @method updateSession
   * @description Update session data
   */
  public updateSession(sessionId: string, data: any): void {
    const session = this.getSession(sessionId);
    if (session) {
      this.sessions.set(sessionId, { ...session, ...data });
    }
  }

  /**
   * @method deleteSession
   * @description Delete a session
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * @method listSessions
   * @description List all sessions
   */
  public listSessions(): any[] {
    return Array.from(this.sessions.values());
  }
}
