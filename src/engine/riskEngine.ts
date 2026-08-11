import { Pool } from 'pg';
import { Detector, RiskSignal } from './types';

export class RiskEngine {
  constructor(private detectors: Detector[]) {}

  async run(pool: Pool): Promise<RiskSignal[]> {
    const results = await Promise.all(this.detectors.map(d => d.detect(pool)));
    return results.flat();
  }
}