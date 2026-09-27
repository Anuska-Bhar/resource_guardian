# Resource Guardian

Resource Guardian is a TypeScript service that monitors resource usage patterns and flags operational risks such as ghost reservations, hoarding, and single points of failure.

It ingests booking or utilization data into PostgreSQL, runs configurable detection rules, caches the latest results in Redis, and exposes a risk report through a Model Context Protocol (MCP) server.

## Why this project exists

Many teams over-allocate or retain underutilized resources without realizing it. Resource Guardian helps identify patterns like:

- Ghost reservations: resources are booked but rarely or never used
- Hoarding: time is reserved far longer than it is actually consumed
- Single points of failure: one resource carries a disproportionate share of workload

This makes it useful for capacity planning, operational visibility, and resilience analysis.

## Architecture

The project is organized around a small risk-analysis pipeline:

- PostgreSQL stores resource and reservation data
- Redis caches the latest computed risk results
- The risk engine runs rule-based detectors
- A demo script and MCP server surface results for local use or integrations

Relevant code:
- [src/engine/riskEngine.ts](src/engine/riskEngine.ts)
- [src/mcp/server.ts](src/mcp/server.ts)
- [src/db/schema.sql](src/db/schema.sql)
- [src/cache/riskCache.ts](src/cache/riskCache.ts)

## Detectors

The current detectors include:

- `GHOST_RESERVATION`: flags resources where a large share of bookings are never used
- `HOARDING`: flags resources whose booked hours are much higher than actual usage
- `SINGLE_POINT_OF_FAILURE`: flags resources that dominate a pool's usage

Each signal includes:
- resource name
- resource ID
- risk score
- reasoning text
- recommended action

## Tech Stack

- TypeScript
- Node.js
- PostgreSQL
- Redis
- Model Context Protocol SDK
- Vitest

## Prerequisites

Before running the project, make sure you have:

- Node.js 18+
- PostgreSQL running locally
- Redis running locally

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and update values if needed:


```bash
cp .env.example .env
```

3. Create the database and schema:


```bash
createdb resource_guardian
psql -d resource_guardian -f src/db/schema.sql
```

## Running the project

1. Run the project:

```bash
npm run demo

```
This loads a risk report from Postgres/Redis and prints the highest-scoring signals.

2. Build the project:

```bash
npm run build
```

3. Start the MCP server:

```bash
npm start
```
The MCP server exposes a tool named get_risk_report and validates an API key via MCP_API_KEY.


4. Ingest data:

```bash
npm run ingest
```
This expects booking CSV data to be available in the expected ingestion path and inserts it into the database schema described in the project.

5. Run tests:

```bash
npm run test
```

## Example output

=== Resource Guardian Risk Report ===
1 risk signals found

[GHOST_RESERVATION] Room Type A (severity: 80%)
  Signal: 8/10 reservations never used
  Recommendation: Add a "confirm attendance" step...

## Project structure
.
├── src/
│   ├── cache/
│   ├── db/
│   ├── demo.ts
│   ├── engine/
│   ├── ingest/
│   └── mcp/
├── tests/
├── .env.example
├── Dockerfile
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md