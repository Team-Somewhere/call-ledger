import { checkDatabaseHealth } from "@call-ledger/database";

export interface HealthCheckResult {
  success: boolean;
  service: string;
  database: "connected" | "disconnected";
  timestamp: string;
  latencyMs?: number;
  error?: string;
}

export async function getSystemHealth(): Promise<HealthCheckResult> {
  const dbHealth = await checkDatabaseHealth();
  const timestamp = new Date().toISOString();

  if (dbHealth.connected) {
    return {
      success: true,
      service: "call-ledger-api",
      database: "connected",
      timestamp,
      latencyMs: dbHealth.latencyMs,
    };
  }

  return {
    success: false,
    service: "call-ledger-api",
    database: "disconnected",
    timestamp,
    error: dbHealth.error,
  };
}
