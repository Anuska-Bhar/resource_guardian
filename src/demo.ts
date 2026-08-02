import 'dotenv/config';
import { Pool } from 'pg';
import { RiskEngine } from './engine/riskEngine';
import { GhostReservationDetector } from './engine/detectors/ghostReservation';
import { HoardingDetector } from './engine/detectors/hoarding';
import { SinglePointOfFailureDetector } from './engine/detectors/singlePointOfFailure';
import { recommend } from './engine/recommend';

async function main() {
  const pool = new Pool();
  const engine = new RiskEngine([
    new GhostReservationDetector(),
    new HoardingDetector(),
    new SinglePointOfFailureDetector(),
  ]);
  const risks = (await engine.run(pool)).sort((a, b) => b.score - a.score);

  console.log(`\n=== Resource Guardian Risk Report ===`);
  console.log(`${risks.length} risk signals found\n`);

  for (const r of risks.slice(0, 10)) {
    console.log(`[${r.type}] ${r.resourceName}  (severity: ${(r.score * 100).toFixed(0)}%)`);
    console.log(`  Signal: ${r.reason}`);
    console.log(`  Recommendation: ${recommend(r)}\n`);
  }

  await pool.end();
}

main().catch(console.error);