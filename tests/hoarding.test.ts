import { describe, it, expect } from 'vitest';
import { HoardingDetector } from '../src/engine/detectors/hoarding';

describe('HoardingDetector', () => {
  it('flags resources with >50% wasted booked hours', async () => {
    const mockPool = {
      query: async () => ({ rows: [{ resource_id: 1, name: 'Suite A', booked: 100, used: 20 }] }),
    };
    const result = await new HoardingDetector().detect(mockPool as any);
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBeCloseTo(0.8);
  });
});