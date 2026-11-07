ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "flash_quote_id" varchar(255);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_parameters" jsonb;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "raw_status" varchar(80);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "close_reason" varchar(160);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_flash_quote_id_uidx" ON "orders" ("flash_quote_id") WHERE "flash_quote_id" IS NOT NULL;

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "wallet_address" varchar(255);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "quote_asset" varchar(255);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "invested_amount" numeric(28, 12) DEFAULT '0';
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "remaining_quantity" numeric(28, 12);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "total_filled_quantity" numeric(28, 12);

CREATE TABLE IF NOT EXISTS "flash_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "wallet_address" varchar(255) NOT NULL,
  "signal_id" uuid REFERENCES "signals"("id") ON DELETE set null,
  "chain" varchar(50) NOT NULL,
  "flash_quote_id" varchar(255) NOT NULL,
  "order_type" varchar(40) NOT NULL,
  "side" varchar(10) NOT NULL,
  "target_asset" varchar(255) NOT NULL,
  "contra_asset" varchar(255) NOT NULL,
  "qty" numeric(28, 12) NOT NULL,
  "quote_request" jsonb NOT NULL,
  "quote_response" jsonb NOT NULL,
  "status" varchar(30) DEFAULT 'ACTIVE' NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "flash_quotes_wallet_quote_uidx" ON "flash_quotes" ("wallet_address", "flash_quote_id");
CREATE INDEX IF NOT EXISTS "flash_quotes_user_id_idx" ON "flash_quotes" ("user_id");
CREATE INDEX IF NOT EXISTS "flash_quotes_signal_id_idx" ON "flash_quotes" ("signal_id");

CREATE TABLE IF NOT EXISTS "order_fills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "flash_order_id" varchar(255) NOT NULL,
  "fill_key" varchar(512) NOT NULL,
  "transaction_hash" varchar(255),
  "chain" varchar(50) NOT NULL,
  "input_amount" numeric(28, 12),
  "output_amount" numeric(28, 12),
  "execution_price" numeric(28, 12),
  "fees" jsonb,
  "fill_timestamp" timestamp with time zone,
  "status" varchar(40),
  "raw" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "order_fills_fill_key_uidx" ON "order_fills" ("fill_key");
CREATE INDEX IF NOT EXISTS "order_fills_order_id_idx" ON "order_fills" ("order_id");
CREATE INDEX IF NOT EXISTS "order_fills_flash_order_id_idx" ON "order_fills" ("flash_order_id");
CREATE INDEX IF NOT EXISTS "order_fills_tx_idx" ON "order_fills" ("transaction_hash");
