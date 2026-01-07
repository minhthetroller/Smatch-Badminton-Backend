// Payment status and method types
type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
type PaymentMethod = 'ZALOPAY';

/**
 * Payment Test Fixtures
 * Mock ZaloPay responses and payment data for testing
 */

// Sample Payment IDs
export const PAYMENT_ID_SUCCESS = '880e8400-e29b-41d4-a716-446655440001';
export const PAYMENT_ID_PENDING = '880e8400-e29b-41d4-a716-446655440002';
export const PAYMENT_ID_FAILED = '880e8400-e29b-41d4-a716-446655440003';
export const PAYMENT_ID_EXPIRED = '880e8400-e29b-41d4-a716-446655440004';

// ZaloPay Test Transaction IDs
export const ZALOPAY_TRANS_ID_SUCCESS = '240101_SMATCH_001';
export const ZALOPAY_TRANS_ID_PENDING = '240101_SMATCH_002';
export const ZALOPAY_TRANS_ID_FAILED = '240101_SMATCH_003';

// ZaloPay App Transaction Tokens
export const ZALOPAY_APP_TRANS_TOKEN_SUCCESS = 'zptoken_success_123456';
export const ZALOPAY_APP_TRANS_TOKEN_PENDING = 'zptoken_pending_789012';

// ZaloPay Order URLs
export const ZALOPAY_ORDER_URL = 'https://sbgateway.zalopay.vn/order/v1/pay';
export const ZALOPAY_QR_CODE_URL = 'https://sbgateway.zalopay.vn/order/qrcode';

// Sample Payments
export const samplePaymentSuccess = {
  id: PAYMENT_ID_SUCCESS,
  matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
  amount: 50000,
  status: 'SUCCESS' as PaymentStatus,
  method: 'ZALOPAY' as PaymentMethod,
  zpTransId: ZALOPAY_TRANS_ID_SUCCESS,
  zpAppTransId: null,
  zpTransToken: null,
  metadata: {
    returnCode: 1,
    returnMessage: 'Success',
    subReturnCode: 1,
    subReturnMessage: 'Success',
  },
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:01:00Z'),
};

export const samplePaymentPending = {
  id: PAYMENT_ID_PENDING,
  matchPlayerId: '660e8400-e29b-41d4-a716-446655440002',
  amount: 75000,
  status: 'PENDING' as PaymentStatus,
  method: 'ZALOPAY' as PaymentMethod,
  zpTransId: null,
  zpAppTransId: ZALOPAY_TRANS_ID_PENDING,
  zpTransToken: ZALOPAY_APP_TRANS_TOKEN_PENDING,
  metadata: null,
  createdAt: new Date('2024-01-01T11:00:00Z'),
  updatedAt: new Date('2024-01-01T11:00:00Z'),
};

export const samplePaymentFailed = {
  id: PAYMENT_ID_FAILED,
  matchPlayerId: '660e8400-e29b-41d4-a716-446655440003',
  amount: 50000,
  status: 'FAILED' as PaymentStatus,
  method: 'ZALOPAY' as PaymentMethod,
  zpTransId: ZALOPAY_TRANS_ID_FAILED,
  zpAppTransId: null,
  zpTransToken: null,
  metadata: {
    returnCode: 2,
    returnMessage: 'Transaction failed',
    subReturnCode: -1,
    subReturnMessage: 'Insufficient balance',
  },
  createdAt: new Date('2024-01-01T12:00:00Z'),
  updatedAt: new Date('2024-01-01T12:01:00Z'),
};

// ZaloPay API Mock Responses

// 1. Create Order - Success Response
export const zaloPayCreateOrderSuccess = {
  return_code: 1,
  return_message: 'Success',
  sub_return_code: 1,
  sub_return_message: 'Success',
  zp_trans_token: ZALOPAY_APP_TRANS_TOKEN_SUCCESS,
  order_url: `${ZALOPAY_ORDER_URL}?token=${ZALOPAY_APP_TRANS_TOKEN_SUCCESS}`,
  order_token: ZALOPAY_APP_TRANS_TOKEN_SUCCESS,
};

// 2. Create Order - Failed Response (Invalid MAC)
export const zaloPayCreateOrderFailure = {
  return_code: 2,
  return_message: 'Failed',
  sub_return_code: 10,
  sub_return_message: 'MAC not equal',
};

// 3. Query Order Status - Success (Paid)
export const zaloPayQueryStatusSuccess = {
  return_code: 1,
  return_message: 'Success',
  sub_return_code: 1,
  sub_return_message: 'Success',
  is_processing: false,
  amount: 50000,
  zp_trans_id: ZALOPAY_TRANS_ID_SUCCESS,
  server_time: Date.now(),
  discount_amount: 0,
};

// 4. Query Order Status - Pending
export const zaloPayQueryStatusPending = {
  return_code: 1,
  return_message: 'Success',
  sub_return_code: 1,
  sub_return_message: 'Success',
  is_processing: true,
  amount: 75000,
  zp_trans_id: '',
  server_time: Date.now(),
  discount_amount: 0,
};

// 5. Query Order Status - Failed (Not Found)
export const zaloPayQueryStatusNotFound = {
  return_code: 2,
  return_message: 'Failed',
  sub_return_code: -1,
  sub_return_message: 'Transaction not found',
  is_processing: false,
};

// 6. Query Order Status - Failed (Payment Failed)
export const zaloPayQueryStatusFailed = {
  return_code: 1,
  return_message: 'Success',
  sub_return_code: 3,
  sub_return_message: 'Payment failed',
  is_processing: false,
  amount: 50000,
  zp_trans_id: ZALOPAY_TRANS_ID_FAILED,
  server_time: Date.now(),
  discount_amount: 0,
};

// 7. Callback Data (from ZaloPay to our backend)
export const zaloPayCallbackSuccess = {
  data: {
    app_id: 2553,
    app_trans_id: ZALOPAY_TRANS_ID_SUCCESS,
    app_time: 1704103200000,
    app_user: '770e8400-e29b-41d4-a716-446655440001',
    amount: 50000,
    embed_data: JSON.stringify({
      matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
      redirecturl: 'smatch://payment-success',
    }),
    item: JSON.stringify([
      {
        itemid: '660e8400-e29b-41d4-a716-446655440001',
        itemname: 'Match Payment',
        itemprice: 50000,
        itemquantity: 1,
      },
    ]),
    zp_trans_id: 240101000000001,
    server_time: 1704103260000,
    channel: 1,
    merchant_user_id: '',
    user_fee_amount: 0,
    discount_amount: 0,
  },
  mac: 'mock_mac_signature',
  type: 1,
};

// QR Code Data
export const qrCodeData = {
  app_id: 2553,
  app_trans_id: ZALOPAY_TRANS_ID_SUCCESS,
  amount: 50000,
  description: 'Thanh toán tham gia trận đấu',
  embed_data: JSON.stringify({
    matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
  }),
  item: JSON.stringify([
    {
      itemid: '660e8400-e29b-41d4-a716-446655440001',
      itemname: 'Match Payment',
      itemprice: 50000,
      itemquantity: 1,
    },
  ]),
  bank_code: 'zalopayapp',
  mac: 'mock_qr_mac',
};

export const qrCodeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Payment Creation DTOs
export const createPaymentDto = {
  matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
  amount: 50000,
  returnUrl: 'smatch://payment-success',
};

export const createPaymentWithQrDto = {
  matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
  amount: 50000,
  generateQr: true,
};

// Invalid Payment DTOs
export const invalidPaymentDtos = {
  missingAmount: {
    matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
  },
  negativeAmount: {
    matchPlayerId: '660e8400-e29b-41d4-a716-446655440001',
    amount: -50000,
  },
  invalidMatchPlayerId: {
    matchPlayerId: 'invalid-uuid',
    amount: 50000,
  },
};

// Payment Status Check Responses
export const paymentStatusResponses = {
  success: {
    status: 'SUCCESS' as PaymentStatus,
    zpTransId: ZALOPAY_TRANS_ID_SUCCESS,
    amount: 50000,
    paidAt: new Date('2024-01-01T10:01:00Z'),
  },
  pending: {
    status: 'PENDING' as PaymentStatus,
    zpTransId: null,
    amount: 75000,
    paidAt: null,
  },
  failed: {
    status: 'FAILED' as PaymentStatus,
    zpTransId: ZALOPAY_TRANS_ID_FAILED,
    amount: 50000,
    failureReason: 'Insufficient balance',
  },
};

// Match Payment Scenarios
export const matchPaymentScenarios = {
  // User joins paid match -> creates PENDING payment
  joinPaidMatch: {
    matchPrice: 50000,
    expectedPaymentStatus: 'PENDING' as PaymentStatus,
    expectedMatchPlayerStatus: 'PENDING_PAYMENT',
  },
  // User joins free match -> no payment created
  joinFreeMatch: {
    matchPrice: 0,
    expectedPaymentStatus: null,
    expectedMatchPlayerStatus: 'ACCEPTED',
  },
  // Payment successful -> player status becomes ACCEPTED
  paymentSuccess: {
    paymentStatus: 'SUCCESS' as PaymentStatus,
    expectedMatchPlayerStatus: 'ACCEPTED',
  },
  // Payment failed -> player status becomes FAILED
  paymentFailed: {
    paymentStatus: 'FAILED' as PaymentStatus,
    expectedMatchPlayerStatus: 'FAILED',
  },
  // Payment expired (30min timeout) -> player status becomes FAILED
  paymentExpired: {
    paymentStatus: 'FAILED' as PaymentStatus,
    expectedMatchPlayerStatus: 'FAILED',
    reason: 'Payment timeout',
  },
};

// Helper function to generate app_trans_id
export function generateAppTransId(): string {
  const date = new Date();
  const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
  const timestamp = Date.now();
  return `${yymmdd}_SMATCH_${timestamp}`;
}

// Helper function to calculate MAC (mock for testing)
export function calculateMockMac(data: Record<string, any>): string {
  const dataString = JSON.stringify(data);
  return `mock_mac_${dataString.length}`;
}

// ZaloPay Error Codes Reference
export const zaloPayErrorCodes = {
  SUCCESS: { code: 1, message: 'Success' },
  FAILED: { code: 2, message: 'Failed' },
  PROCESSING: { code: 3, message: 'Processing' },
  MAC_INVALID: { code: 2, subCode: 10, message: 'MAC not equal' },
  TRANSACTION_NOT_FOUND: { code: 2, subCode: -1, message: 'Transaction not found' },
  PAYMENT_FAILED: { code: 1, subCode: 3, message: 'Payment failed' },
  INSUFFICIENT_BALANCE: { code: 2, subCode: -1, message: 'Insufficient balance' },
};
