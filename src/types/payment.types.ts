// Payment status
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'expired';

// Payment type
export type PaymentType = 'BOOKING' | 'MATCH_JOIN';

// DTO for creating a payment
export interface CreatePaymentDto {
  bookingId: string;
}

// Payment response
export interface PaymentResponse {
  id: string;
  bookingId: string | null;  // Can be null for match payments
  matchPlayerId?: string | null;  // For match payments
  paymentType?: PaymentType;
  appTransId: string;
  zpTransId: string | null;
  amount: number;
  status: PaymentStatus;
  orderUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// QR code data for mobile apps
export interface QRCodeData {
  base64: string;        // Full data URL: data:image/png;base64,xxxxx
  rawBase64: string;     // Raw base64 without prefix (for Flutter Image.memory)
}

// Response when creating a payment (includes QR code for Flutter)
export interface CreatePaymentResponse {
  payment: PaymentResponse;
  orderUrl: string;
  qrCode: QRCodeData;     // QR code image for Flutter app
  zpTransToken: string | null;  // Token for ZaloPay SDK (mobile)
  expireAt: string;       // ISO timestamp when the slot lock expires
  wsSubscribeUrl: string; // WebSocket URL to subscribe for payment updates
}

// ZaloPay Create Order Request
export interface ZaloPayCreateOrderRequest {
  app_id: number;
  app_user: string;
  app_trans_id: string;
  app_time: number;
  amount: number;
  item: string;
  description: string;
  embed_data: string;
  bank_code: string;
  mac: string;
  callback_url?: string;
}

// ZaloPay Create Order Response
export interface ZaloPayCreateOrderResponse {
  return_code: number; // 1 = success, 2 = fail
  return_message: string;
  sub_return_code: number;
  sub_return_message: string;
  order_url?: string;
  zp_trans_token?: string;
  order_token?: string;
  qr_code?: string;
}

// ZaloPay Callback Data
export interface ZaloPayCallbackData {
  app_id: number;
  app_trans_id: string;
  app_time: number;
  app_user: string;
  amount: number;
  embed_data: string;
  item: string;
  zp_trans_id: number;
  server_time: number;
  channel: number;
  merchant_user_id: string;
  user_fee_amount: number;
  discount_amount: number;
}

// ZaloPay Callback Request (raw from ZaloPay)
export interface ZaloPayCallbackRequest {
  data: string; // JSON string of ZaloPayCallbackData
  mac: string;
  type: number;
}

// ZaloPay Callback Response (what we send back)
export interface ZaloPayCallbackResponse {
  return_code: number; // 1 = success, 2 = fail
  return_message: string;
}

// ZaloPay Query Order Request
export interface ZaloPayQueryOrderRequest {
  app_id: number;
  app_trans_id: string;
  mac: string;
}

// ZaloPay Query Order Response
export interface ZaloPayQueryOrderResponse {
  return_code: number; // 1 = success, 2 = fail, 3 = processing
  return_message: string;
  sub_return_code: number;
  sub_return_message: string;
  is_processing: boolean;
  amount: number;
  discount_amount: number;
  zp_trans_id: number;
}

// Embedded data in ZaloPay order
export interface ZaloPayEmbedData {
  bookingId: string;
  redirecturl?: string;
}

// Payment with booking info (for queries)
export interface PaymentWithBooking extends PaymentResponse {
  booking: {
    id: string;
    subCourtId: string;
    guestName: string | null;
    guestPhone: string | null;
    date: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    status: string;
  };
}

