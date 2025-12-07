import crypto from 'crypto';
import { config } from '../config/index.js';
import type {
  ZaloPayCreateOrderRequest,
  ZaloPayCreateOrderResponse,
  ZaloPayCallbackData,
  ZaloPayCallbackRequest,
  ZaloPayQueryOrderRequest,
  ZaloPayQueryOrderResponse,
  ZaloPayEmbedData,
} from '../types/index.js';

class ZaloPayService {
  private readonly endpoint: string;
  private readonly appId: number;
  private readonly key1: string;
  private readonly key2: string;
  private readonly callbackUrl: string;

  constructor() {
    this.endpoint = config.zalopay.endpoint;
    this.appId = Number(config.zalopay.appId);
    this.key1 = config.zalopay.key1;
    this.key2 = config.zalopay.key2;
    this.callbackUrl = config.zalopay.callbackUrl;
  }

  /**
   * Generate app_trans_id in format: yymmdd_bookingIdSuffix
   * Must be unique per day, prefixed with yymmdd (Vietnam timezone GMT+7)
   */
  generateAppTransId(bookingId: string): string {
    // Get current date in Vietnam timezone (GMT+7)
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const year = String(vietnamTime.getUTCFullYear()).slice(-2);
    const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(vietnamTime.getUTCDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Use last 8 chars of booking UUID + random suffix for uniqueness
    const bookingSuffix = bookingId.replace(/-/g, '').slice(-8);
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');

    return `${datePrefix}_${bookingSuffix}${randomSuffix}`;
  }

  /**
   * Create MAC for order creation
   * hmacinput: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
   */
  private createOrderMac(params: {
    appId: number;
    appTransId: string;
    appUser: string;
    amount: number;
    appTime: number;
    embedData: string;
    item: string;
  }): string {
    const hmacInput = `${params.appId}|${params.appTransId}|${params.appUser}|${params.amount}|${params.appTime}|${params.embedData}|${params.item}`;
    return crypto.createHmac('sha256', this.key1).update(hmacInput).digest('hex');
  }

  /**
   * Create MAC for callback verification
   * hmacinput: data (the raw JSON string)
   */
  private createCallbackMac(data: string): string {
    return crypto.createHmac('sha256', this.key2).update(data).digest('hex');
  }

  /**
   * Create MAC for query order
   * hmacinput: app_id|app_trans_id|key1
   */
  private createQueryMac(appTransId: string): string {
    const hmacInput = `${this.appId}|${appTransId}|${this.key1}`;
    return crypto.createHmac('sha256', this.key1).update(hmacInput).digest('hex');
  }

  /**
   * Create a ZaloPay order
   */
  async createOrder(params: {
    bookingId: string;
    appTransId: string;
    amount: number;
    guestName: string;
    guestPhone: string;
    description: string;
  }): Promise<ZaloPayCreateOrderResponse> {
    const appTime = Date.now();

    // Sanitize app_user (max 50 chars, alphanumeric + underscore)
    const appUser = `${params.guestName}_${params.guestPhone}`
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 50);

    // Create embed_data with booking ID for callback
    const embedData: ZaloPayEmbedData = {
      bookingId: params.bookingId,
    };
    const embedDataStr = JSON.stringify(embedData);

    // Item data (empty array as string)
    const item = '[]';

    // Create MAC
    const mac = this.createOrderMac({
      appId: this.appId,
      appTransId: params.appTransId,
      appUser,
      amount: params.amount,
      appTime,
      embedData: embedDataStr,
      item,
    });

    // Build request body
    const requestBody: ZaloPayCreateOrderRequest = {
      app_id: this.appId,
      app_user: appUser,
      app_trans_id: params.appTransId,
      app_time: appTime,
      amount: params.amount,
      item,
      description: params.description,
      embed_data: embedDataStr,
      bank_code: '', // Empty for QR payment (dynamic QR)
      mac,
    };

    // Add callback URL if configured
    if (this.callbackUrl) {
      requestBody.callback_url = this.callbackUrl;
    }

    // Make API request
    const response = await fetch(`${this.endpoint}/v2/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = (await response.json()) as ZaloPayCreateOrderResponse;
    return result;
  }

  /**
   * Verify and parse callback from ZaloPay
   * Returns parsed data if valid, null if invalid MAC
   */
  verifyCallback(callbackRequest: ZaloPayCallbackRequest): ZaloPayCallbackData | null {
    const { data, mac } = callbackRequest;

    // Verify MAC
    const expectedMac = this.createCallbackMac(data);
    if (mac !== expectedMac) {
      console.error('ZaloPay callback MAC verification failed');
      return null;
    }

    // Parse data
    try {
      return JSON.parse(data) as ZaloPayCallbackData;
    } catch {
      console.error('ZaloPay callback data parse error');
      return null;
    }
  }

  /**
   * Extract booking ID from callback embed_data
   */
  extractBookingIdFromCallback(callbackData: ZaloPayCallbackData): string | null {
    try {
      const embedData = JSON.parse(callbackData.embed_data) as ZaloPayEmbedData;
      return embedData.bookingId || null;
    } catch {
      return null;
    }
  }

  /**
   * Query order status from ZaloPay
   */
  async queryOrder(appTransId: string): Promise<ZaloPayQueryOrderResponse> {
    const mac = this.createQueryMac(appTransId);

    const requestBody: ZaloPayQueryOrderRequest = {
      app_id: this.appId,
      app_trans_id: appTransId,
      mac,
    };

    const response = await fetch(`${this.endpoint}/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = (await response.json()) as ZaloPayQueryOrderResponse;
    return result;
  }

  /**
   * Check if ZaloPay is properly configured
   */
  isConfigured(): boolean {
    return !!(this.appId && this.key1 && this.key2);
  }
}

export const zaloPayService = new ZaloPayService();

