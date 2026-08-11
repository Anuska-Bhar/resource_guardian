import { Pool } from 'pg';
import { Detector, RiskSignal } from './types';
import { GhostReservationDetector } from './detectors/ghostReservation';
import { HoardingDetector } from './detectors/hoarding';
import { SinglePointOfFailureDetector } from './detectors/singlePointOfFailure';

export class RiskEngine {
  constructor(private detectors: Detector[]) {}

  async run(pool: Pool): Promise<RiskSignal[]> {
    const results = await Promise.all(this.detectors.map(d => d.detect(pool)));
    return results.flat();
  }
}

export function createRiskEngine(): RiskEngine {
  return new RiskEngine([
    new GhostReservationDetector(),
    new HoardingDetector(),
    new SinglePointOfFailureDetector(),
  ]);
}