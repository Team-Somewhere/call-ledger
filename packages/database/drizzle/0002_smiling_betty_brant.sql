CREATE TABLE "creator_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"source_type" varchar(20) NOT NULL,
	"external_id" varchar(500),
	"handle" varchar(255),
	"canonical_url" varchar(2048) NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"verification_status" varchar(30) DEFAULT 'UNVERIFIED' NOT NULL,
	"display_name" varchar(255),
	"description" text,
	"avatar_url" text,
	"last_fetched_at" timestamp with time zone,
	"next_fetch_at" timestamp with time zone,
	"last_cursor" text,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"etag" varchar(500),
	"last_modified" varchar(255),
	"crawl_authorized" boolean DEFAULT false NOT NULL,
	"provider_meta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_identity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"creator_source_id" uuid NOT NULL,
	"relationship_type" varchar(40) NOT NULL,
	"verification_method" varchar(40) DEFAULT 'NONE' NOT NULL,
	"verified_by_user_id" uuid,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_creator_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notification_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(42) NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"user_id" uuid,
	"domain" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invalidated_at" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "creators" ALTER COLUMN "x_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ALTER COLUMN "x_username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "creators" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "creator_sources" ADD CONSTRAINT "creator_sources_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_identity_links" ADD CONSTRAINT "creator_identity_links_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_identity_links" ADD CONSTRAINT "creator_identity_links_creator_source_id_creator_sources_id_fk" FOREIGN KEY ("creator_source_id") REFERENCES "public"."creator_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_identity_links" ADD CONSTRAINT "creator_identity_links_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_creator_follows" ADD CONSTRAINT "user_creator_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_creator_follows" ADD CONSTRAINT "user_creator_follows_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_nonces" ADD CONSTRAINT "wallet_nonces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_sources_creator_type_identity_idx" ON "creator_sources" USING btree ("creator_id","source_type",coalesce("external_id", "handle", "canonical_url"));--> statement-breakpoint
CREATE INDEX "creator_sources_creator_id_idx" ON "creator_sources" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_sources_type_idx" ON "creator_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "creator_sources_status_idx" ON "creator_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "creator_sources_next_fetch_at_idx" ON "creator_sources" USING btree ("next_fetch_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_identity_links_source_idx" ON "creator_identity_links" USING btree ("creator_source_id");--> statement-breakpoint
CREATE INDEX "creator_identity_links_creator_idx" ON "creator_identity_links" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_creator_follows_user_creator_idx" ON "user_creator_follows" USING btree ("user_id","creator_id");--> statement-breakpoint
CREATE INDEX "user_creator_follows_user_active_idx" ON "user_creator_follows" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "user_creator_follows_creator_idx" ON "user_creator_follows" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_nonces_nonce_idx" ON "wallet_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "wallet_nonces_address_idx" ON "wallet_nonces" USING btree ("address");--> statement-breakpoint
CREATE INDEX "wallet_nonces_expires_at_idx" ON "wallet_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_x_username_lower_idx" ON "creators" USING btree (lower("x_username"));