CREATE TABLE "x_account_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"x_user_id" varchar(255) NOT NULL,
	"x_username" varchar(255) NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"scopes" varchar(500),
	"connection_status" varchar(50) DEFAULT 'CONNECTED' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" varchar(128) NOT NULL,
	"code_verifier_encrypted" text NOT NULL,
	"user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_monitoring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"monitoring_status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"poll_interval_seconds" integer DEFAULT 900 NOT NULL,
	"next_poll_at" timestamp with time zone DEFAULT now(),
	"last_poll_started_at" timestamp with time zone,
	"last_poll_completed_at" timestamp with time zone,
	"last_successful_poll_at" timestamp with time zone,
	"last_seen_post_id" varchar(255),
	"pagination_token" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(50),
	"last_error_message" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"lock_acquired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"source" varchar(50) DEFAULT 'X' NOT NULL,
	"source_post_id" varchar(255) NOT NULL,
	"source_author_id" varchar(255) NOT NULL,
	"created_at_source" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_storage_status" varchar(50) DEFAULT 'STORED' NOT NULL,
	"content_text" text,
	"public_metrics" jsonb,
	"edit_history" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_discovery_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_reference" varchar(500),
	"discovered_by" uuid,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "creator_poll_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(50) NOT NULL,
	"posts_fetched" integer DEFAULT 0 NOT NULL,
	"posts_inserted" integer DEFAULT 0 NOT NULL,
	"posts_updated" integer DEFAULT 0 NOT NULL,
	"posts_rejected" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"rate_limit_remaining" integer,
	"rate_limit_reset_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "discovery_source" varchar(50) DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "qualification_score" integer;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "qualification_notes" text;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "qualified_by" uuid;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "qualified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "is_x_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "monitoring_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "last_polled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "last_post_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "x_account_connections" ADD CONSTRAINT "x_account_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_monitoring" ADD CONSTRAINT "creator_monitoring_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_posts" ADD CONSTRAINT "source_posts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_discovery_sources" ADD CONSTRAINT "creator_discovery_sources_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_poll_logs" ADD CONSTRAINT "creator_poll_logs_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "x_connections_user_id_idx" ON "x_account_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "x_connections_x_user_id_idx" ON "x_account_connections" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "x_connections_status_idx" ON "x_account_connections" USING btree ("connection_status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_states_state_hash_idx" ON "oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_monitoring_creator_id_idx" ON "creator_monitoring" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_monitoring_next_poll_at_idx" ON "creator_monitoring" USING btree ("next_poll_at");--> statement-breakpoint
CREATE INDEX "creator_monitoring_status_idx" ON "creator_monitoring" USING btree ("monitoring_status");--> statement-breakpoint
CREATE UNIQUE INDEX "source_posts_source_post_id_idx" ON "source_posts" USING btree ("source","source_post_id");--> statement-breakpoint
CREATE INDEX "source_posts_creator_id_idx" ON "source_posts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "source_posts_created_at_source_idx" ON "source_posts" USING btree ("created_at_source");--> statement-breakpoint
CREATE INDEX "source_posts_captured_at_idx" ON "source_posts" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "source_posts_content_status_idx" ON "source_posts" USING btree ("content_storage_status");--> statement-breakpoint
CREATE INDEX "discovery_sources_creator_id_idx" ON "creator_discovery_sources" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "discovery_sources_type_idx" ON "creator_discovery_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "poll_logs_creator_id_idx" ON "creator_poll_logs" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "poll_logs_started_at_idx" ON "creator_poll_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "poll_logs_status_idx" ON "creator_poll_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "creators_monitoring_enabled_idx" ON "creators" USING btree ("monitoring_enabled");