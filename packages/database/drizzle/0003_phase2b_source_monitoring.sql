CREATE TABLE "creator_source_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_source_id" uuid NOT NULL,
	"external_post_id" varchar(1000) NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"author_external_id" varchar(500),
	"author_handle" varchar(255),
	"title" varchar(500),
	"content" text,
	"canonical_url" varchar(2048),
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"media_urls" jsonb,
	"is_reply" boolean DEFAULT false NOT NULL,
	"is_repost" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"provider_meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_monitoring_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_source_id" uuid NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"items_inserted" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" varchar(80),
	"error_message" text,
	"trigger" varchar(30) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creator_sources" ADD COLUMN "lock_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creator_sources" ADD COLUMN "locked_by" varchar(120);--> statement-breakpoint
ALTER TABLE "creator_sources" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_sources" ADD COLUMN "permanent_error_code" varchar(80);--> statement-breakpoint
ALTER TABLE "creator_source_posts" ADD CONSTRAINT "creator_source_posts_creator_source_id_creator_sources_id_fk" FOREIGN KEY ("creator_source_id") REFERENCES "public"."creator_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_monitoring_logs" ADD CONSTRAINT "creator_monitoring_logs_creator_source_id_creator_sources_id_fk" FOREIGN KEY ("creator_source_id") REFERENCES "public"."creator_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_source_posts_source_external_idx" ON "creator_source_posts" USING btree ("creator_source_id","external_post_id");--> statement-breakpoint
CREATE INDEX "creator_source_posts_source_idx" ON "creator_source_posts" USING btree ("creator_source_id");--> statement-breakpoint
CREATE INDEX "creator_source_posts_published_at_idx" ON "creator_source_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "creator_source_posts_fetched_at_idx" ON "creator_source_posts" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "creator_source_posts_external_post_id_idx" ON "creator_source_posts" USING btree ("external_post_id");--> statement-breakpoint
CREATE INDEX "creator_source_posts_content_hash_idx" ON "creator_source_posts" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "creator_source_posts_feed_idx" ON "creator_source_posts" USING btree ("source_type","published_at");--> statement-breakpoint
CREATE INDEX "creator_monitoring_logs_source_idx" ON "creator_monitoring_logs" USING btree ("creator_source_id","started_at");--> statement-breakpoint
CREATE INDEX "creator_monitoring_logs_started_at_idx" ON "creator_monitoring_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "creator_monitoring_logs_status_idx" ON "creator_monitoring_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "creator_sources_lock_expires_at_idx" ON "creator_sources" USING btree ("lock_expires_at");