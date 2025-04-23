interface Session {
  userId: string;
  lastSeen: number;
}

export class ActiveUsersSQLite {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/heartbeat") {
      const userId = request.headers.get("X-User-ID");
      if (!userId) return new Response("No user ID provided", { status: 400 });

      // Update or create session
      const session: Session = {
        userId,
        lastSeen: Date.now()
      };

      // Store in SQLite
      await this.state.storage.put(`session:${session.userId}`, session);

      // Clean up old sessions
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      // Get all sessions and clean up old ones
      const allSessions = await this.state.storage.list({ prefix: 'session:' });
      for (const [key, value] of allSessions) {
        const session = value as Session;
        if (session.lastSeen < fiveMinutesAgo) {
          await this.state.storage.delete(key);
        }
      }

      // Count active users (after cleanup)
      const activeSessions = await this.state.storage.list({ prefix: 'session:' });
      const activeUsers = Array.from(activeSessions).length;

      return new Response(JSON.stringify({
        activeUsers
      }));
    }

    return new Response("Not found", { status: 404 });
  }


}
