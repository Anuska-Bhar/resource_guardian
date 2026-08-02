import 'dotenv/config';
import { Pool } from 'pg';
import { RiskEngine } from './engine/riskEngine';
import { GhostReservationDetector } from './engine/detectors/ghostReservation';
import { HoardingDetector } from './engine/detectors/hoarding';
import { SinglePointOfFailureDetector } from './engine/detectors/singlePointOfFailure';

async function main() {
  const pool = new Pool();
  const engine = new RiskEngine([
    new GhostReservationDetector(),
    new HoardingDetector(),
    new SinglePointOfFailureDetector(),
  ]);
  const risks = await engine.run(pool);
  console.log(`Found ${risks.length} risk signals:\n`);
  console.log(JSON.stringify(risks.slice(0, 10), null, 2));
  await pool.end();
}

main().catch(console.error);