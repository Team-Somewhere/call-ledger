/**
 * Future background job handlers roadmap:
 * - Phase 2: Ingest X creator profiles and public tweets
 * - Phase 3: AI signal classification and parameter extraction
 * - Phase 4: Verification engine for token prices and trade outcomes
 * - Phase 5: Definitive Flash order monitoring and status reconciliation
 * - Phase 6: Arkiv attestation record publishing
 */

export interface RegisteredJob {
  name: string;
  status: "IDLE" | "RUNNING" | "PAUSED";
  phase: string;
  description: string;
}

export const futureWorkerJobs: RegisteredJob[] = [
  {
    name: "x-ingestion",
    status: "PAUSED",
    phase: "Phase 2",
    description: "Polls and ingests tweets from qualified trading creators",
  },
  {
    name: "ai-classification",
    status: "PAUSED",
    phase: "Phase 3",
    description: "Extracts trade signals, direction, SL, and TP from posts",
  },
  {
    name: "signal-verification",
    status: "PAUSED",
    phase: "Phase 4",
    description: "Verifies market outcomes and calculates creator win rates",
  },
  {
    name: "arkiv-publisher",
    status: "PAUSED",
    phase: "Phase 6",
    description: "Anchors verified signals and performance snapshots to Arkiv",
  },
];
