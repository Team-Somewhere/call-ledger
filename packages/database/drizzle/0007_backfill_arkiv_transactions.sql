-- Backfill transaction receipts created before arkiv_transactions existed.
INSERT INTO "arkiv_transactions" (
  "entity_key",
  "tx_hash",
  "source_post_id",
  "trader_id",
  "trader_username",
  "status",
  "submitted_at",
  "confirmed_at",
  "expires_at",
  "created_at"
)
SELECT
  records."entity_key",
  records."tx_hash",
  records."source_post_id",
  records."related_creator_id",
  records."author_username",
  'CONFIRMED',
  records."created_at",
  records."created_at",
  records."expires_at",
  records."created_at"
FROM "arkiv_records" AS records
WHERE records."tx_hash" IS NOT NULL
  AND btrim(records."tx_hash") <> ''
  AND records."source_post_id" IS NOT NULL
ON CONFLICT ("tx_hash") DO NOTHING;
