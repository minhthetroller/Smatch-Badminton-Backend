/**
 * Notification Service
 * Handles FCM push notifications using Firebase Admin SDK
 */

import { getMessaging } from 'firebase-admin/messaging';
import type { Message, MulticastMessage } from 'firebase-admin/messaging';
import { initializeFirebase } from '../config/firebase.js';
import { userRepository } from '../repositories/user.repository.js';
import type {
  FcmNotificationPayload,
  MatchJoinRequestNotificationData,
  MatchRequestResponseNotificationData,
  MatchPlayerLeftNotificationData,
  MatchStatusChangeNotificationData,
  MatchCancelledNotificationData,
} from '../types/notification.types.js';

export class NotificationService {
  private messaging;

  constructor() {
    const app = initializeFirebase();
    this.messaging = getMessaging(app);
  }

  /**
   * Send notification to a single user
   */
  async sendToUser(userId: string, payload: FcmNotificationPayload): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return;
    }

    await this.sendToTokens(user.fcmTokens, payload);
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds: string[], payload: FcmNotificationPayload): Promise<void> {
    await Promise.all(userIds.map((userId) => this.sendToUser(userId, payload)));
  }

  /**
   * Send notification to specific FCM tokens
   */
  async sendToTokens(tokens: string[], payload: FcmNotificationPayload): Promise<void> {
    if (tokens.length === 0) return;

    const message: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: this.serializeData(payload.data),
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'match_notifications',
        },
      },
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);
      console.log(`✅ Sent ${response.successCount} notifications, ${response.failureCount} failed`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (
              error?.code === 'messaging/invalid-registration-token' ||
              error?.code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]!);
            }
          }
        });

        if (invalidTokens.length > 0) {
          console.log(`🧹 Cleaning up ${invalidTokens.length} invalid tokens`);
          // Note: You'll need to implement removeInvalidTokens in userRepository
        }
      }
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error);
      throw error;
    }
  }

  /**
   * Serialize notification data (all values must be strings)
   */
  private serializeData(data: any): Record<string, string> {
    const serialized: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return serialized;
  }

  // ==================== MATCH NOTIFICATIONS ====================

  /**
   * Notify host when someone requests to join their match
   */
  async notifyMatchJoinRequest(
    hostUserId: string,
    matchId: string,
    matchTitle: string,
    playerName: string,
    playerId: string
  ): Promise<void> {
    const data: MatchJoinRequestNotificationData = {
      type: 'match_join_request',
      matchId,
      matchTitle,
      playerName,
      playerId,
    };

    await this.sendToUser(hostUserId, {
      title: '🏸 New Match Request',
      body: `${playerName} wants to join "${matchTitle}"`,
      data,
    });
  }

  /**
   * Notify player when host responds to their join request
   */
  async notifyMatchRequestResponse(
    playerId: string,
    matchId: string,
    matchTitle: string,
    accepted: boolean
  ): Promise<void> {
    const data: MatchRequestResponseNotificationData = {
      type: 'match_request_response',
      matchId,
      matchTitle,
      accepted,
    };

    await this.sendToUser(playerId, {
      title: accepted ? '✅ Request Accepted' : '❌ Request Declined',
      body: accepted
        ? `You can now join "${matchTitle}"`
        : `Your request to join "${matchTitle}" was declined`,
      data,
    });
  }

  /**
   * Notify all match participants when a player leaves
   */
  async notifyMatchPlayerLeft(
    participantUserIds: string[],
    matchId: string,
    matchTitle: string,
    playerName: string
  ): Promise<void> {
    const data: MatchPlayerLeftNotificationData = {
      type: 'match_player_left',
      matchId,
      matchTitle,
      playerName,
    };

    await this.sendToUsers(participantUserIds, {
      title: '🚪 Player Left Match',
      body: `${playerName} left "${matchTitle}"`,
      data,
    });
  }

  /**
   * Notify all participants when match status changes
   */
  async notifyMatchStatusChange(
    participantUserIds: string[],
    matchId: string,
    matchTitle: string,
    status: string
  ): Promise<void> {
    const data: MatchStatusChangeNotificationData = {
      type: 'match_status_change',
      matchId,
      matchTitle,
      status,
    };

    let title = '📢 Match Update';
    let body = `"${matchTitle}" status: ${status}`;

    switch (status) {
      case 'FULL':
        title = '✅ Match Full';
        body = `"${matchTitle}" is now full`;
        break;
      case 'IN_PROGRESS':
        title = '🏸 Match Started';
        body = `"${matchTitle}" has started`;
        break;
      case 'COMPLETED':
        title = '🎉 Match Completed';
        body = `"${matchTitle}" has finished`;
        break;
    }

    await this.sendToUsers(participantUserIds, {
      title,
      body,
      data,
    });
  }

  /**
   * Notify all participants when match is cancelled
   */
  async notifyMatchCancelled(
    participantUserIds: string[],
    matchId: string,
    matchTitle: string,
    reason?: string
  ): Promise<void> {
    const data: MatchCancelledNotificationData = {
      type: 'match_cancelled',
      matchId,
      matchTitle,
      reason,
    };

    await this.sendToUsers(participantUserIds, {
      title: '❌ Match Cancelled',
      body: reason ? `"${matchTitle}" cancelled: ${reason}` : `"${matchTitle}" has been cancelled`,
      data,
    });
  }
}

export const notificationService = new NotificationService();
