/**
 * Notification Types
 * Types and DTOs for FCM push notifications
 */

/**
 * DTO for registering/updating FCM token
 */
export interface RegisterFcmTokenDto {
  token: string;
}

/**
 * FCM notification data for match join request
 */
export interface MatchJoinRequestNotificationData {
  type: 'match_join_request';
  matchId: string;
  matchTitle: string;
  playerName: string;
  playerId: string;
}

/**
 * FCM notification data for match request response (accept/reject)
 */
export interface MatchRequestResponseNotificationData {
  type: 'match_request_response';
  matchId: string;
  matchTitle: string;
  accepted: boolean;
}

/**
 * FCM notification data for player leaving match
 */
export interface MatchPlayerLeftNotificationData {
  type: 'match_player_left';
  matchId: string;
  matchTitle: string;
  playerName: string;
}

/**
 * FCM notification data for match status change
 */
export interface MatchStatusChangeNotificationData {
  type: 'match_status_change';
  matchId: string;
  matchTitle: string;
  status: string;
}

/**
 * FCM notification data for match cancellation
 */
export interface MatchCancelledNotificationData {
  type: 'match_cancelled';
  matchId: string;
  matchTitle: string;
  reason?: string;
}

/**
 * Union type for all notification data
 */
export type NotificationData =
  | MatchJoinRequestNotificationData
  | MatchRequestResponseNotificationData
  | MatchPlayerLeftNotificationData
  | MatchStatusChangeNotificationData
  | MatchCancelledNotificationData;

/**
 * FCM notification payload
 */
export interface FcmNotificationPayload {
  title: string;
  body: string;
  data: NotificationData;
}
