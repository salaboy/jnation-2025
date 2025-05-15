export interface VisitorStats {
  totalVisitors: number;
  uniqueVisitors: Set<string>;
  activeUsers: number;
}

export interface VisitorTrackerConfig {
  userId: string;
  visitorIp: string | null;
  activeUsersNamespace: DurableObjectNamespace;
  visitorKV: KVNamespace;
}

export async function trackVisitors(config: VisitorTrackerConfig): Promise<VisitorStats> {
  // Get active users count
  const id = config.activeUsersNamespace.idFromName('counter');
  const activeUsersObj = config.activeUsersNamespace.get(id);

  const activeUsersReq = new Request('https://dummy-url/heartbeat', {
    headers: { 'X-User-ID': config.userId }
  });
  const activeUsersRes = await activeUsersObj.fetch(activeUsersReq);
  const { activeUsers } = await activeUsersRes.json() as { activeUsers: number };

  // Track total visitors
  const totalVisitors = parseInt(await config.visitorKV.get('total') || '0') + 1;
  await config.visitorKV.put('total', totalVisitors.toString());

  // Track unique visitors by IP (last 24h)
  const today = new Date().toISOString().split('T')[0];
  const uniqueKey = `unique_${today}`;
  const uniqueVisitors = new Set<string>(
    (await config.visitorKV.get(uniqueKey, 'json') || []) as string[]
  );

  if (config.visitorIp) {
    uniqueVisitors.add(config.visitorIp);
    await config.visitorKV.put(
      uniqueKey,
      JSON.stringify([...uniqueVisitors]),
      { expirationTtl: 86400 }
    );
  }

  return {
    totalVisitors,
    uniqueVisitors,
    activeUsers
  };
}
