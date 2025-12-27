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
  status: 'success' | 'failed' | 'expired' | 'cancelled';
  bookingId?: string | null;
  matchPlayerId?: string | null;
  zpTransId?: string;
  message: string;
}

// ==================== MATCH NOTIFICATION TYPES ====================

export interface MatchJoinRequestNotification {
  type: 'match_join_request';
  matchId: string;
  playerId: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  message: string | null;
  queuePosition: number;
  timestamp: string;
}

export interface MatchRequestResponseNotification {
  type: 'match_request_response';
  matchId: string;
  playerId: string;
  status: 'ACCEPTED' | 'REJECTED';
  position: number | null;
  message: string;
}

export interface MatchPlayerLeftNotification {
  type: 'match_player_left';
  matchId: string;
  userId: string;
  userName: string;
  slotsRemaining: number;
}

export interface MatchStatusChangeNotification {
  type: 'match_status_change';
  matchId: string;
  status: string;
  message: string;
}

export type MatchNotification =
  | MatchJoinRequestNotification
  | MatchRequestResponseNotification
  | MatchPlayerLeftNotification
  | MatchStatusChangeNotification;

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private matchWss: WebSocketServer | null = null;
  private subscriptions: Map<string, Set<WebSocket>> = new Map(); // paymentId -> Set of WebSocket connections
  private wsToPaymentIds: WeakMap<WebSocket, Set<string>> = new WeakMap(); // Track which payments each WebSocket is subscribed to
  // Match subscriptions
  private matchSubscriptions: Map<string, Set<WebSocket>> = new Map(); // matchId -> Set of WebSocket connections
  private wsToMatchIds: WeakMap<WebSocket, Set<string>> = new WeakMap(); // Track which matches each WebSocket is subscribed to
  private userToWs: Map<string, Set<WebSocket>> = new Map(); // userId -> Set of WebSocket connections for direct user notifications

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(server: Server): void {
    // Payment WebSocket
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
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to payment notification service' }));
    });

    console.log('WebSocket server initialized on /ws/payments');

    // Match WebSocket
    this.initializeMatchWebSocket(server);
  }

  /**
   * Initialize Match WebSocket server
   */
  private initializeMatchWebSocket(server: Server): void {
    this.matchWss = new WebSocketServer({ server, path: '/ws/matches' });

    this.matchWss.on('connection', (ws: WebSocket) => {
      console.log('Match WebSocket client connected');

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString()) as { 
            action: string; 
            matchId?: string; 
            userId?: string;
          };
          this.handleMatchMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('Match WebSocket client disconnected');
        this.handleMatchDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('Match WebSocket error:', error);
        this.handleMatchDisconnect(ws);
      });

      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to match notification service' }));
    });

    console.log('Match WebSocket server initialized on /ws/matches');
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
    
    // Track this subscription for the WebSocket
    let wsPaymentIds = this.wsToPaymentIds.get(ws);
    if (!wsPaymentIds) {
      wsPaymentIds = new Set();
      this.wsToPaymentIds.set(ws, wsPaymentIds);
    }
    wsPaymentIds.add(paymentId);
    
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
    
    // Remove from tracking
    const wsPaymentIds = this.wsToPaymentIds.get(ws);
    if (wsPaymentIds) {
      wsPaymentIds.delete(paymentId);
    }
    
    console.log(`Client unsubscribed from payment ${paymentId}`);
  }

  /**
   * Handle WebSocket disconnect - cancel any pending payments
   */
  private handleDisconnect(ws: WebSocket): void {
    const paymentIds = this.wsToPaymentIds.get(ws);
    
    if (paymentIds && paymentIds.size > 0) {
      // Use dynamic import to avoid circular dependency
      import('./payment.service.js').then(({ paymentService }) => {
        for (const paymentId of paymentIds) {
          paymentService.cancelPayment(paymentId)
            .then(() => {
              console.log(`Auto-cancelled payment ${paymentId} due to client disconnect`);
            })
            .catch((error: Error) => {
              // Payment might already be completed/failed, ignore errors
              console.log(`Could not auto-cancel payment ${paymentId}:`, error.message);
            });
        }
      }).catch(console.error);
    }
    
    this.removeFromAllSubscriptions(ws);
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
    this.wsToPaymentIds.delete(ws);
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

  // ==================== MATCH WEBSOCKET METHODS ====================

  /**
   * Handle incoming match WebSocket messages
   */
  private handleMatchMessage(ws: WebSocket, data: { action: string; matchId?: string; userId?: string }): void {
    switch (data.action) {
      case 'subscribe':
        if (data.matchId) {
          this.subscribeToMatch(data.matchId, ws, data.userId);
          ws.send(JSON.stringify({ 
            type: 'subscribed', 
            matchId: data.matchId,
            message: `Subscribed to match ${data.matchId}` 
          }));
        } else {
          ws.send(JSON.stringify({ error: 'matchId is required for subscribe action' }));
        }
        break;

      case 'unsubscribe':
        if (data.matchId) {
          this.unsubscribeFromMatch(data.matchId, ws, data.userId);
          ws.send(JSON.stringify({ 
            type: 'unsubscribed', 
            matchId: data.matchId,
            message: `Unsubscribed from match ${data.matchId}` 
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
   * Subscribe to match notifications
   */
  subscribeToMatch(matchId: string, ws: WebSocket, userId?: string): void {
    // Subscribe to match
    if (!this.matchSubscriptions.has(matchId)) {
      this.matchSubscriptions.set(matchId, new Set());
    }
    this.matchSubscriptions.get(matchId)!.add(ws);

    // Track for cleanup
    let wsMatchIds = this.wsToMatchIds.get(ws);
    if (!wsMatchIds) {
      wsMatchIds = new Set();
      this.wsToMatchIds.set(ws, wsMatchIds);
    }
    wsMatchIds.add(matchId);

    // Also track by userId for direct notifications
    if (userId) {
      if (!this.userToWs.has(userId)) {
        this.userToWs.set(userId, new Set());
      }
      this.userToWs.get(userId)!.add(ws);
    }

    console.log(`Client subscribed to match ${matchId}${userId ? ` (user: ${userId})` : ''}`);
  }

  /**
   * Unsubscribe from match notifications
   */
  unsubscribeFromMatch(matchId: string, ws: WebSocket, userId?: string): void {
    const subscribers = this.matchSubscriptions.get(matchId);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.matchSubscriptions.delete(matchId);
      }
    }

    const wsMatchIds = this.wsToMatchIds.get(ws);
    if (wsMatchIds) {
      wsMatchIds.delete(matchId);
    }

    if (userId) {
      const userWs = this.userToWs.get(userId);
      if (userWs) {
        userWs.delete(ws);
        if (userWs.size === 0) {
          this.userToWs.delete(userId);
        }
      }
    }

    console.log(`Client unsubscribed from match ${matchId}`);
  }

  /**
   * Handle match WebSocket disconnect
   */
  private handleMatchDisconnect(ws: WebSocket): void {
    // Remove from all match subscriptions
    for (const [matchId, subscribers] of this.matchSubscriptions.entries()) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.matchSubscriptions.delete(matchId);
      }
    }
    this.wsToMatchIds.delete(ws);

    // Remove from user tracking
    for (const [userId, wsSet] of this.userToWs.entries()) {
      wsSet.delete(ws);
      if (wsSet.size === 0) {
        this.userToWs.delete(userId);
      }
    }
  }

  /**
   * Notify all subscribers of a match about an event
   */
  notifyMatchSubscribers(matchId: string, notification: MatchNotification): void {
    const subscribers = this.matchSubscriptions.get(matchId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for match ${matchId}`);
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

    console.log(`Notified ${notifiedCount} match subscribers for match ${matchId}`);
  }

  /**
   * Notify a specific user directly (e.g., for accept/reject notifications)
   */
  notifyUser(userId: string, notification: MatchNotification): void {
    const userConnections = this.userToWs.get(userId);
    if (!userConnections || userConnections.size === 0) {
      console.log(`No WebSocket connections for user ${userId}`);
      return;
    }

    const message = JSON.stringify(notification);
    let notifiedCount = 0;

    for (const ws of userConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        notifiedCount++;
      }
    }

    console.log(`Notified user ${userId} via ${notifiedCount} connections`);
  }

  /**
   * Notify match host about a new join request
   */
  notifyMatchHost(hostUserId: string, notification: MatchJoinRequestNotification): void {
    this.notifyUser(hostUserId, notification);
  }

  /**
   * Notify a player about their request status
   */
  notifyMatchPlayer(userId: string, notification: MatchRequestResponseNotification): void {
    this.notifyUser(userId, notification);
  }

  /**
   * Get number of subscribers for a match
   */
  getMatchSubscriptionCount(matchId: string): number {
    return this.matchSubscriptions.get(matchId)?.size ?? 0;
  }

  /**
   * Get total match WebSocket connection count
   */
  getMatchConnectionCount(): number {
    return this.matchWss?.clients.size ?? 0;
  }

  /**
   * Close all connections and shutdown
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.matchWss) {
      this.matchWss.close();
      this.matchWss = null;
    }
    this.subscriptions.clear();
    this.matchSubscriptions.clear();
    this.userToWs.clear();
  }
}

export const websocketService = new WebSocketService();

