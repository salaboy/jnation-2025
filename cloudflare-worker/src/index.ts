import { createFiberplane, createOpenAPISpec } from "@fiberplane/hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { getRandomLocation } from "./lib/locationProvider";
import { calculatePrice } from "./lib/pricingCalculator";
import { updateRegionStats } from "./lib/regionMetricsCollector";
import { trackVisitors } from "./lib/visitorTracker";
import { getProductByRegion } from "./lib/regionProductFetcher";
import { OrderUpdateService } from "./websocket/orderUpdateSocket";


import { ActiveUsersSQLite } from './activeUsers';

type Variables = {
  orderService: DurableObjectStub;
};

type Bindings = {
  DB: D1Database;
  VISITORS: KVNamespace;
  ACTIVE_USERS: DurableObjectNamespace;
  ORDER_UPDATE_SERVICE: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Generate a unique ID for each user session
function generateUserId() {
  return crypto.randomUUID();
}

app.use("*", async (c, next) => {
  const orderServiceId = c.env.ORDER_UPDATE_SERVICE.idFromName("default");
  const orderServiceStub = c.env.ORDER_UPDATE_SERVICE.get(orderServiceId);
  c.set("orderService", orderServiceStub);
  
  await next();
});

app.get("/api/geese", async (c) => {
  // Get or create user ID from cookie
  let userId = getCookie(c, 'user_id');
  if (!userId) {
    userId = generateUserId();
    setCookie(c, 'user_id', userId, { maxAge: 86400 }); // 24 hours
  }

  const headers = c.req.raw.headers;
  const visitorIp = headers.get('cf-connecting-ip');

  // Track visitors using the visitor tracker service
  const visitorStats = await trackVisitors({
    userId,
    visitorIp,
    activeUsersNamespace: c.env.ACTIVE_USERS,
    visitorKV: c.env.VISITORS
  });

  const ip = headers.get('cf-connecting-ip') || 'unknown';
  //Location information from the headers
  // const country = headers.get('cf-ipcountry') || 'unknown';
  // const city = headers.get('cf-city') || 'unknown';
  // const region = headers.get('cf-region') || 'unknown';
  // const postal = headers.get('cf-postal-code') || 'unknown';
  // const timezone = headers.get('cf-timezone') || 'unknown';

  //Random location information
  const randomLocation = getRandomLocation();
  const country = randomLocation.country;
  const city = randomLocation.city;
  const region = randomLocation.region;
  const postal = randomLocation.postal;
  const timezone = randomLocation.timezone;

  const browserLanguage = headers.get('Accept-Language') || 'unknown';

  // Calculate price using the pricing calculator
  const pricing = calculatePrice(visitorStats.activeUsers);

  // Get region stats
  const stats = await updateRegionStats(region, c.env.VISITORS, visitorStats.activeUsers, visitorStats.uniqueVisitors);

  // Get the goose for the current region
  const goose = await getProductByRegion(region, c.env.DB);

  return c.json({
    ip,
    location: {
      country,
      city,
      region,
      postal,
      timezone,
    },
    goose,  // Will be null if no goose exists for this region
    stats,
    browserLanguage,
  });
});

// New endpoints for order updates
app.get("/ws/order/:orderId", async (c) => {
  if (c.req.header("upgrade") !== "websocket") {
    return c.text("Not a websocket request", 426);
  }
  
  const stub = c.get("orderService");
  return stub.fetch(c.req.raw);
});

// Endpoint to update an order status (called by your order processing system)
app.post("/update-order", async (c) => {
  const body = await c.req.json();
  
  const stub = c.get("orderService");
  const response = await stub.fetch(new Request("https://internal/update-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }));
  
  const responseData = await response.json();
  return c.json(responseData as Record<string, unknown>);
});

// Endpoint to get all order updates
app.get("/order-updates", async (c) => {
  const stub = c.get("orderService");
  const response = await stub.fetch(new Request("https://internal/updates"));
  const data = await response.json() as { updates: Record<string, unknown>[] };
  return c.json(data);
});

export { OrderUpdateService };



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
