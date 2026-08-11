import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { createRiskEngine } from '../engine/riskEngine';
import { getCachedRisks } from '../cache/riskCache';
import { z } from 'zod';

const pool = new Pool();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const engine = createRiskEngine();

const server = new McpServer({ name: 'resource-guardian', version: '1.0.0' });

server.tool(
  'get_risk_report',
  'Returns current resource risk signals: ghost reservations, hoarding, single points of failure',
  {
    apiKey: z.string().describe('API Key for authentication'),
  },
  async ({ apiKey }) => {
    const validApiKey = process.env.MCP_API_KEY || 'default-secure-key';

    if (apiKey !== validApiKey) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Unauthorized: Invalid API key' }],
      };
    }

    const risks = await getCachedRisks(redis, pool, engine);
    return { content: [{ type: 'text', text: JSON.stringify(risks, null, 2) }] };
  }
);

server.connect(new StdioServerTransport());