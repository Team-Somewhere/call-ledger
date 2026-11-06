-- Phase 3: Arkiv transaction receipt history
-- One row per confirmed Arkiv write. Lightweight index of on-chain receipts.
-- Post content is NOT stored here — content lives in Arkiv Rabdi.

CREATE TABLE IF NOT EXISTS "arkiv_transactions" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_key"      varchar(512)  NOT NULL,
  "tx_hash"         varchar(512)  NOT NULL UNIQUE,
  "source_post_id"  varchar(500)  NOT NULL,
  "trader_id"       uuid          REFERENCES "creators"("id") ON DELETE SET NULL,
  "trader_username" varchar(255),
  "status"          varchar(20)   NOT NULL DEFAULT 'CONFIRMED',
  "submitted_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "confirmed_at"    timestamp with time zone,
  "expires_at"      timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "arkiv_tx_trader_id_idx"      ON "arkiv_transactions" ("trader_id");
CREATE INDEX IF NOT EXISTS "arkiv_tx_source_post_id_idx" ON "arkiv_transactions" ("source_post_id");
CREATE INDEX IF NOT EXISTS "arkiv_tx_submitted_at_idx"   ON "arkiv_transactions" ("submitted_at");
CREATE INDEX IF NOT EXISTS "arkiv_tx_status_idx"         ON "arkiv_transactions" ("status");
CREATE INDEX IF NOT EXISTS "arkiv_tx_confirmed_at_idx"   ON "arkiv_transactions" ("confirmed_at");
