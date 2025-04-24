import { instrument } from "@fiberplane/hono-otel";
import { createFiberplane, createOpenAPISpec } from "@fiberplane/hono";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import * as schema from "./db/schema";

import { ActiveUsersSQLite } from './activeUsers';

type Bindings = {
  DB: D1Database;
  VISITORS: KVNamespace;
  ACTIVE_USERS: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Generate a unique ID for each user session
function generateUserId() {
  return crypto.randomUUID();
}

app.get("/", async (c) => {
  // Get or create user ID from cookie
  let userId = getCookie(c, 'user_id');
  if (!userId) {
    userId = generateUserId();
    setCookie(c, 'user_id', userId, { maxAge: 86400 }); // 24 hours
  }

  // Get stub for the active users counter
  const id = c.env.ACTIVE_USERS.idFromName('counter');
  const activeUsersObj = c.env.ACTIVE_USERS.get(id);

  // Send heartbeat to update active users
  const activeUsersReq = new Request('https://dummy-url/heartbeat', {
    headers: { 'X-User-ID': userId }
  });
  const activeUsersRes = await activeUsersObj.fetch(activeUsersReq);
  const { activeUsers } = await activeUsersRes.json() as { activeUsers: number };
  const headers = c.req.raw.headers;

  // Increment total visitor count
  const totalVisitors = parseInt(await c.env.VISITORS.get('total') || '0') + 1;
  await c.env.VISITORS.put('total', totalVisitors.toString());

  // Track unique visitors by IP (last 24h)
  const today = new Date().toISOString().split('T')[0];
  const uniqueKey = `unique_${today}`;
  const uniqueVisitors = new Set<string>((await c.env.VISITORS.get(uniqueKey, 'json') || []) as string[]);
  const visitorIp = headers.get('cf-connecting-ip');
  if (visitorIp) uniqueVisitors.add(visitorIp);
  await c.env.VISITORS.put(uniqueKey, JSON.stringify([...uniqueVisitors]), { expirationTtl: 86400 });

  const ip = headers.get('cf-connecting-ip') || 'unknown';
  const country = headers.get('cf-ipcountry') || 'unknown';
  const city = headers.get('cf-city') || 'unknown';
  const region = headers.get('cf-region') || 'unknown';
  const postal = headers.get('cf-postal-code') || 'unknown';
  const timezone = headers.get('cf-timezone') || 'unknown';

  const browserLanguage = headers.get('Accept-Language') || 'unknown';

  // Calculate dynamic price based on active users
  const basePrice = 9.15; // Base price in euros
  // Calculate price increase based on number of active users
  // For every 10 users, add 0.30 euros (30 cents)
  // e.g., 10 users = +0.30€, 20 users = +0.60€, 30 users = +0.90€
  const userGroups = Math.floor(activeUsers / 10); // How many complete groups of 10 users
  const priceIncrease = userGroups * 0.30; // 0.30€ increase per 10 users
  const dynamicPrice = basePrice + priceIncrease;

  // Track users by region
  const regionKey = `region_${today}`;
  const regionCounts = JSON.parse(await c.env.VISITORS.get(regionKey) || '{}') as Record<string, number>;
  if (region !== 'unknown') {
    regionCounts[region] = (regionCounts[region] || 0) + 1;
    await c.env.VISITORS.put(regionKey, JSON.stringify(regionCounts), { expirationTtl: 86400 });
  }

  // Get the most active region
  const mostActiveRegion = Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([region]) => region)[0] || 'None';

  return c.json({
    ip,
    country,
    city,
    region,
    postal,
    timezone,
    browserLanguage,
    stats: {
      totalVisitors,
      uniqueVisitorsToday: uniqueVisitors.size,
      currentlyActive: activeUsers,
      mostActiveRegion
    },
    pricing: {
      basePrice,
      currentPrice: dynamicPrice,
      message: `Price is ${dynamicPrice.toFixed(3)}€ due to ${activeUsers} active users!`
    }
  });
});


/**
 * Serve a simplified api specification for your API
 * As of writing, this is just the list of routes and their methods.
 */
app.get("/openapi.json", c => {
  // @ts-expect-error - @fiberplane/hono is in beta and still not typed correctly
  return c.json(createOpenAPISpec(app, {
    openapi: "3.0.0",
    info: {
      title: "Honc D1 App",
      version: "1.0.0",
    },
  }))
});

/**
 * Mount the Fiberplane api explorer to be able to make requests against your API.
 * 
 * Visit the explorer at `/fp`
 */
app.use("/fp/*", createFiberplane({
  app,
  openapi: { url: "/openapi.json" }
}));


export default app;

// Export the Durable Object
export { ActiveUsersSQLite };

// Export the instrumented app if you've wired up a Fiberplane-Hono-OpenTelemetry trace collector
//
// export default instrument(app);
