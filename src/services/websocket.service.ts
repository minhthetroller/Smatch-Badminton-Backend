import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface PaymentSubscription {
  paymentId: string;
  ws: WebSocket;
  createdAt: Date;
}

export interface PaymentNotification {
  type: 'payment_status';
  paymentId: string;
  status: 'success' | 'failed' | 'expired';
  bookingId: string;
  zpTransId?: string;
  message: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private subscriptions: Map<string, Set<WebSocket>> = new Map(); // paymentId -> Set of WebSocket connections

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws/payments' });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString()) as { action: string; paymentId?: string };
          this.handleMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.removeFromAllSubscriptions(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeFromAllSubscriptions(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to payment notification service' }));
    });

    console.log('WebSocket server initialized on /ws/payments');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, data: { action: string; paymentId?: string }): void {
    switch (data.action) {
      case 'subscribe':
        if (data.paymentId) {
          this.subscribe(data.paymentId, ws);
          ws.send(JSON.stringify({ 
            type: 'subscribed', 
            paymentId: data.paymentId,
            message: `Subscribed to payment ${data.paymentId}` 
          }));
        } else {
          ws.send(JSON.stringify({ error: 'paymentId is required for subscribe action' }));
        }
        break;

      case 'unsubscribe':
        if (data.paymentId) {
          this.unsubscribe(data.paymentId, ws);
          ws.send(JSON.stringify({ 
            type: 'unsubscribed', 
            paymentId: data.paymentId,
            message: `Unsubscribed from payment ${data.paymentId}` 
          }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({ error: `Unknown action: ${data.action}` }));
    }
  }

  /**
   * Subscribe a WebSocket connection to a payment
   */
  subscribe(paymentId: string, ws: WebSocket): void {
    if (!this.subscriptions.has(paymentId)) {
      this.subscriptions.set(paymentId, new Set());
    }
    this.subscriptions.get(paymentId)!.add(ws);
    console.log(`Client subscribed to payment ${paymentId}`);
  }

  /**
   * Unsubscribe a WebSocket connection from a payment
   */
  unsubscribe(paymentId: string, ws: WebSocket): void {
    const subscribers = this.subscriptions.get(paymentId);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(paymentId);
      }
    }
  }

  /**
   * Remove a WebSocket connection from all subscriptions
   */
  private removeFromAllSubscriptions(ws: WebSocket): void {
    for (const [paymentId, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.subscriptions.delete(paymentId);
      }
    }
  }

  /**
   * Notify all subscribers of a payment status change
   */
  notifyPaymentStatus(notification: PaymentNotification): void {
    const subscribers = this.subscriptions.get(notification.paymentId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for payment ${notification.paymentId}`);
      return;
    }

    const message = JSON.stringify(notification);
    let notifiedCount = 0;

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        notifiedCount++;
      }
    }

    console.log(`Notified ${notifiedCount} subscribers for payment ${notification.paymentId}`);

    // Clean up subscription after notification (payment is complete)
    this.subscriptions.delete(notification.paymentId);
  }

  /**
   * Get number of active connections
   */
  getConnectionCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  /**
   * Get number of subscriptions for a payment
   */
  getSubscriptionCount(paymentId: string): number {
    return this.subscriptions.get(paymentId)?.size ?? 0;
  }

  /**
   * Close all connections and shutdown
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.subscriptions.clear();
  }
}

export const websocketService = new WebSocketService();

