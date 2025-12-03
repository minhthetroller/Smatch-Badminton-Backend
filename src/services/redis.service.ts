import { Redis } from 'ioredis';
import { config } from '../config/index.js';

class RedisService {
  private client: Redis | null = null;

  /**
   * Get Redis client instance (lazy initialization)
   */
  getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Redis connected successfully');
      });
    }
    return this.client;
  }

  /**
   * Acquire a lock for a time slot
   * Returns true if lock acquired, false if slot is already locked
   */
  async acquireSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const ttl = config.payment.slotLockTtlSeconds;

    // Use SET NX (only set if not exists) with expiration
    const result = await this.getClient().set(key, bookingId, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  /**
   * Release a time slot lock
   * Only releases if the lock belongs to the given bookingId
   */
  async releaseSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);

    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.getClient().eval(script, 1, key, bookingId);
    return result === 1;
  }

  /**
   * Check if a slot is locked
   */
  async isSlotLocked(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const result = await this.getClient().exists(key);
    return result === 1;
  }

  /**
   * Get the booking ID that holds the lock for a slot
   */
  async getSlotLockHolder(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<string | null> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    return await this.getClient().get(key);
  }

  /**
   * Extend the lock TTL for a slot
   */
  async extendSlotLock(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string,
    bookingId: string
  ): Promise<boolean> {
    const key = this.buildSlotLockKey(subCourtId, date, startTime, endTime);
    const ttl = config.payment.slotLockTtlSeconds;

    // Only extend if the lock belongs to this booking
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    const result = await this.getClient().eval(script, 1, key, bookingId, ttl);
    return result === 1;
  }

  /**
   * Build the Redis key for a slot lock
   */
  private buildSlotLockKey(
    subCourtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): string {
    return `slot_lock:${subCourtId}:${date}:${startTime}:${endTime}`;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export const redisService = new RedisService();

