import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { RiskEngine } from '../engine/riskEngine';
import { GhostReservationDetector } from '../engine/detectors/ghostReservation';
import { HoardingDetector } from '../engine/detectors/hoarding';
import { SinglePointOfFailureDetector } from '../engine/detectors/singlePointOfFailure';
import { getCachedRisks } from '../cache/riskCache';

const pool = new Pool();
const redis = new Redis(process.env.REDIS_URL);
const engine = new RiskEngine([
  new GhostReservationDetector(),
  new HoardingDetector(),
  new SinglePointOfFailureDetector(),
]);

const server = new McpServer({ name: 'resource-guardian', version: '1.0.0' });

server.tool('get_risk_report', 'Returns current resource risk signals: ghost reservations, hoarding, single points of failure', {}, async () => {
  const risks = await getCachedRisks(redis, pool, engine);
  return { content: [{ type: 'text', text: JSON.stringify(risks, null, 2) }] };
});

server.connect(new StdioServerTransport());