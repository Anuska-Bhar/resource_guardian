import { Pool } from 'pg';
export interface RiskSignal {
  type: string;
  resourceId: number;
  resourceName: string;
  score: number;
  reason: string;
}
export interface Detector {
  detect(pool: Pool): Promise<RiskSignal[]>;
}