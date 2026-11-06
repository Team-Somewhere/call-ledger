ALTER TABLE "arkiv_records" ALTER COLUMN "record_type" SET DEFAULT 'ARCHIVED_X_POST';--> statement-breakpoint
ALTER TABLE "arkiv_records" ALTER COLUMN "entity_key" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "arkiv_records" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "arkiv_records" ALTER COLUMN "owner_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "tx_hash" varchar(512);--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "source_platform" varchar(50);--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "source_post_id" varchar(500);--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "author_username" varchar(255);--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "content_fidelity" varchar(30);--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "trading_related" boolean;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD COLUMN "creator_source_post_id" uuid;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD CONSTRAINT "arkiv_records_creator_source_post_id_creator_source_posts_id_fk" FOREIGN KEY ("creator_source_post_id") REFERENCES "public"."creator_source_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arkiv_records_source_post_idx" ON "arkiv_records" USING btree ("source_post_id");--> statement-breakpoint
CREATE INDEX "arkiv_records_author_idx" ON "arkiv_records" USING btree ("author_username");--> statement-breakpoint
CREATE INDEX "arkiv_records_trading_related_idx" ON "arkiv_records" USING btree ("trading_related");--> statement-breakpoint
CREATE INDEX "arkiv_records_expires_at_idx" ON "arkiv_records" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "arkiv_records_platform_post_idx" ON "arkiv_records" USING btree ("source_platform","source_post_id");