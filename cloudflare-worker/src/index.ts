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

// The URL for the remote third party API you want to fetch from
// but does not implement CORS
const API_URL = "http://localhost:8080";

// The endpoint you want the CORS reverse proxy to be on
const PROXY_ENDPOINT = "/proxy/";

type Variables = {
  orderService: DurableObjectStub;
};

type Bindings = {
  DB: D1Database;
  VISITORS: KVNamespace;
  ACTIVE_USERS: DurableObjectNamespace;
  GOOSE_STORE: R2Bucket;
  ORDER_UPDATE_SERVICE: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Generate a unique ID for each user session
function generateUserId() {
  return crypto.randomUUID();
}

app.use("*", async (c, next) => {
  // Only handle non-proxy requests with this handler
  if (c.req.path.startsWith(PROXY_ENDPOINT)) {
    return next();
  }

  const orderServiceId = c.env.ORDER_UPDATE_SERVICE.idFromName("default");
  const orderServiceStub = c.env.ORDER_UPDATE_SERVICE.get(orderServiceId);
  c.set("orderService", orderServiceStub);
  
  await next();
});

app.get("/api/geese", async (c) => {
  // Only handle non-proxy requests with this handler
  if (c.req.path.startsWith(PROXY_ENDPOINT)) {
    return next();
  }
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


  // Get region stats
  const stats = await updateRegionStats(region, c.env.VISITORS, visitorStats.activeUsers, visitorStats.uniqueVisitors);

  // Get the goose for the current region
  const goose = await getProductByRegion(region, c.env.DB);

    // Calculate price using the pricing calculator
  const pricing = calculatePrice(visitorStats.activeUsers, goose?.base_price ?? 0.5); // Default price if no goose found

  // Get the image for the current region
  const imageName = `${region.toLowerCase().replace(/ /g, '-')}.svg`;
  console.log('Fetching image for region:', region, 'filename:', imageName);
  
  // Try to get the image from R2
  let imageData = null;
  try {
    // Get the image object
    const imageObj = await c.env.GOOSE_STORE.get(imageName);
    console.log('Image found:', !!imageObj);
    
    if (imageObj) {
      const arrayBuffer = await imageObj.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      imageData = {
        contentType: imageObj.httpMetadata?.contentType || 'image/svg+xml',
        data: `data:image/svg+xml;base64,${base64}`
      };
      console.log('Successfully loaded image for region:', region);
    } else {
      console.log('No image found for region:', region);
    }
  } catch (error) {
    console.error('Error reading local file:', error);
  }
  if (imageData) {
    console.log('Final image data structure:', imageData);
  }

  return c.json({
    ip,
    location: {
      country,
      city,
      region,
      postal,
      timezone,
    },
    image: imageData,
    pricing,
    goose, 
    stats,
    browserLanguage,
  });
});


// New endpoints for order updates
app.get("/ws/order/:orderId", async (c) => {
  // Only handle non-proxy requests with this handler
  if (c.req.path.startsWith(PROXY_ENDPOINT)) {
    return next();
  }
  if (c.req.header("upgrade") !== "websocket") {
    return c.text("Not a websocket request", 426);
  }
  
  const stub = c.get("orderService");
  return stub.fetch(c.req.raw);
});

// Endpoint to update an order status (called by your order processing system)
app.post("/update-order", async (c) => {
  // Only handle non-proxy requests with this handler

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

export { OrderUpdateService };



/**
 * Serve a simplified api specification for your API
 * As of writing, this is just the list of routes and their methods.
 */
app.get("/openapi.json", c => {
  // @ts-expect-error - @fiberplane/hono is in beta and still not typed correctly
  // Only handle non-proxy requests with this handler
  if (c.req.path.startsWith(PROXY_ENDPOINT)) {
    return next();
  }
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

// CORS proxy routes
app.on(["GET", "HEAD", "POST", "OPTIONS"], PROXY_ENDPOINT + "*", async (c) => {
  const url = new URL(c.req.url);

  // Handle OPTIONS preflight requests
  if (c.req.method === "OPTIONS") {
    const origin = c.req.header("Origin");
    const requestMethod = c.req.header("Access-Control-Request-Method");
    const requestHeaders = c.req.header("Access-Control-Request-Headers");

    if (origin && requestMethod && requestHeaders) {
      // Handle CORS preflight requests
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
          "Access-Control-Max-Age": "86400",
          "Access-Control-Allow-Headers": requestHeaders,
        },
      });
    } else {
      // Handle standard OPTIONS request
      return new Response(null, {
        headers: {
          Allow: "GET, HEAD, POST, OPTIONS",
        },
      });
    }
  }

  // Handle actual requests
  let apiUrl = url.searchParams.get("apiurl") || API_URL;

  // Rewrite request to point to API URL
  const modifiedRequest = new Request(apiUrl, c.req.raw);
  modifiedRequest.headers.set("Origin", new URL(apiUrl).origin);

  let response = await fetch(modifiedRequest);

  // Recreate the response so we can modify the headers
  response = new Response(response.body, response);

  // Set CORS headers
  response.headers.set("Access-Control-Allow-Origin", url.origin);

  // Append to/Add Vary header so browser will cache response correctly
  response.headers.append("Vary", "Origin");

  return response;
});

// Handle method not allowed for proxy endpoint
app.all(PROXY_ENDPOINT + "*", (c) => {
  return new Response(null, {
    status: 405,
    statusText: "Method Not Allowed",
  });
});

export default app;

// Export the Durable Object
export { ActiveUsersSQLite };

// Export the instrumented app if you've wired up a Fiberplane-Hono-OpenTelemetry trace collector
//
// export default instrument(app);
