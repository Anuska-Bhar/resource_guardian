import 'dotenv/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { createRiskEngine } from './engine/riskEngine';
import { recommend } from './engine/recommend';
import { getCachedRisks } from './cache/riskCache';

async function main() {
  const pool = new Pool();
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    lazyConnect: true,
  });
  redis.on('error', (err) => console.warn('Redis notice:', err.message));

  const engine = createRiskEngine();

  const risks = (await getCachedRisks(redis, pool, engine)).sort((a, b) => b.score - a.score);
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