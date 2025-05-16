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
    
    async fetch(request: Request) {
      const url = new URL(request.url);
      
      // WebSocket connection endpoint with order ID
      if (url.pathname.startsWith("/ws/order/")) {
        // Extract order ID from URL - this allows connecting to a specific order's updates
        const orderId = url.pathname.split("/ws/order/")[1];
        
        if (!orderId) {
          return new Response("Order ID required", { status: 400 });
        }
        
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        
        server.accept();
        
        // Store connection mapped to order ID
        this.orderConnections.set(orderId, server);
        
        server.addEventListener("message", async (event) => {
          // Handle client messages if needed
          console.log(`Message from client for order ${orderId}:`, event.data);
        });
        
        server.addEventListener("close", () => {
          // Clean up when the connection closes
          this.orderConnections.delete(orderId);
        });
        
        // Send initial connection confirmation
        server.send(JSON.stringify({ 
          type: "connected", 
          message: `Connected to updates for order ${orderId}` 
        }));
        
        return new Response(null, { status: 101, webSocket: client });
      }
      
      // Endpoint for internal systems to send order updates
      if (url.pathname === "/update-order") {
        const rawData = await request.json();
        const result = orderUpdateSchema.safeParse(rawData);
        
        if (!result.success) {
          return new Response(JSON.stringify({
            error: 'Invalid request data',
            details: result.error.errors
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const { orderId, status, details } = result.data;
        
        if (!orderId) {
          return new Response("Order ID required", { status: 400 });
        }
        
        // Send update to the specific order's connection
        const success = await this.sendOrderUpdate(orderId, status, details);
        
        return new Response(JSON.stringify({ 
          success, 
          message: success ? "Update sent" : "Order connection not found" 
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
        connection.send(JSON.stringify({
          type: "order-update",
          orderId,
          status,
          details,
          timestamp: new Date().toISOString()
        }));
        return true;
      }
      
      return false;
    }
  }