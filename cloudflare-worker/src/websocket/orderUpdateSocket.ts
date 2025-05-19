import { z } from 'zod';

const orderUpdateSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  details: z.any()
});

type OrderUpdateRequest = z.infer<typeof orderUpdateSchema>;

export class OrderUpdateService implements DurableObject {
    // Map order IDs to WebSocket connections
    private orderConnections: Map<string, WebSocket> = new Map();
    // Store order status history
    private orderHistory: Map<string, Array<{type: string, orderId: string, status: string, details: any, timestamp: string}>> = new Map();
    // Track session start times to avoid replaying recent updates
    private sessionStartTimes: Map<string, number> = new Map();
    
    async fetch(request: Request) {
      const url = new URL(request.url);
      
      // WebSocket connection endpoint with order ID
      if (url.pathname.startsWith("/ws/order/")) {
        // Extract order ID from URL - this allows connecting to a specific order's updates
        const orderId = url.pathname.split("/ws/order/")[1];
        console.log(`New WebSocket connection request for order: ${orderId}`);
        
        if (!orderId) {
          console.error("No order ID provided in WebSocket connection request");
          return new Response("Order ID required", { status: 400 });
        }
        
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        
        server.accept();
        console.log(`WebSocket connection accepted for order: ${orderId}`);
        
        // Store connection mapped to order ID and record session start time
        this.orderConnections.set(orderId, server);
        const sessionStartTime = Date.now();
        this.sessionStartTimes.set(orderId, sessionStartTime);
        console.log(`Current connections after adding ${orderId}:`, Array.from(this.orderConnections.keys()));
        
        // Connection is now established before order is placed, so no need for pending updates
        
        server.addEventListener("message", async (event) => {
          // Handle client messages if needed
          console.log(`Message from client for order ${orderId}:`, event.data);
        });
        
        server.addEventListener("close", () => {
          // Clean up when the connection closes
          console.log(`WebSocket connection closed for order: ${orderId}`);
          this.orderConnections.delete(orderId);
          this.sessionStartTimes.delete(orderId);
          console.log('Current connections after removal:', Array.from(this.orderConnections.keys()));
        });
        
        // Send initial connection confirmation
        server.send(JSON.stringify({ 
          type: "connected", 
          message: `Connected to updates for order ${orderId}` 
        }));
        console.log(`Sent connection confirmation to order: ${orderId}`);
        
        // Send order history (only updates from before this session)
        const history = this.orderHistory.get(orderId) || [];
        const currentSessionStart = this.sessionStartTimes.get(orderId) || Date.now();
        const oldUpdates = history.filter(update => new Date(update.timestamp).getTime() < currentSessionStart);
        
        if (oldUpdates.length > 0) {
          console.log(`Sending ${oldUpdates.length} historical updates for order ${orderId}`);
          for (const update of oldUpdates) {
            server.send(JSON.stringify(update));
          }
        }
        
        return new Response(null, { status: 101, webSocket: client });
      }
      
      // Endpoint for internal systems to send order updates
      if (url.pathname === "/update-order") {
        console.log("Received update request");
        const rawData = await request.json();
        console.log("Update data:", rawData);
        const result = orderUpdateSchema.safeParse(rawData);
        
        if (!result.success) {
          console.error("Invalid update data:", result.error.errors);
          return new Response(JSON.stringify({
            error: 'Invalid request data',
            details: result.error.errors
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const { orderId, status, details } = result.data;
        console.log(`Processing update for order ${orderId}, status: ${status}`);
        
        if (!orderId) {
          console.error("No order ID provided");
          return new Response("Order ID required", { status: 400 });
        }
        
        // Log current connections
        console.log("Current connections:", Array.from(this.orderConnections.keys()));
        
        // Send update to the specific order's connection
        const connection = this.orderConnections.get(orderId);
        if (!connection) {
          console.log(`No connection for order ${orderId}, update will be missed`);
          return new Response('No WebSocket connection found for this order', { status: 404 });
        }
        
        const success = await this.sendOrderUpdate(orderId, status, details);
        
        return new Response(JSON.stringify({ 
          success, 
          message: success ? "Update sent" : "Update stored for later delivery" 
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return new Response("Not found", { status: 404 });
    }
    
    // Send update to a specific order's WebSocket
    async sendOrderUpdate(orderId: string, status: string, details: any) {
      const connection = this.orderConnections.get(orderId);
      
      if (connection && connection.readyState === WebSocket.READY_STATE_OPEN) {
        const update = {
          type: "order-update",
          orderId,
          status,
          details,
          timestamp: new Date().toISOString()
        };

        // Store update in history for this specific order
        if (!this.orderHistory.has(orderId)) {
          this.orderHistory.set(orderId, []);
        }
        this.orderHistory.get(orderId)?.push(update);

        connection.send(JSON.stringify(update));
        return true;
      }
      
      return false;
    }
  }