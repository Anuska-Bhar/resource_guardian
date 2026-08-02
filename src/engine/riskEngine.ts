import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { Detector, RiskSignal } from './types';

export class RiskEngine {
  constructor(
    private detectors: Detector[],
    private redis?: Redis
  ) {}

  async run(pool: Pool): Promise<RiskSignal[]> {
    const CACHE_KEY = 'risk_report:latest';
    const CACHE_TTL = 300; // Cache for 5 minutes

    if (this.redis) {
      try {
        const cachedData = await this.redis.get(CACHE_KEY);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
      } catch (err) {
        console.warn('Redis read failed or unavailable. Falling back to DB query.');
      }
    }

    const results = await Promise.all(this.detectors.map(d => d.detect(pool)));
    const flatResults = results.flat();

    // 3. Try to save to Redis cache if available
    if (this.redis) {
      this.redis.set(CACHE_KEY, JSON.stringify(flatResults), 'EX', CACHE_TTL).catch((err) => {
        console.warn('Failed to cache risk report in Redis:', err.message);
      });
    }

    return flatResults;
  }
}