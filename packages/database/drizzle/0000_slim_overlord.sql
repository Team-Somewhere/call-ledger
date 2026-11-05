CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100),
	"display_name" varchar(255),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" varchar(255) NOT NULL,
	"chain_id" varchar(50) NOT NULL,
	"wallet_type" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"x_user_id" varchar(255) NOT NULL,
	"x_username" varchar(255) NOT NULL,
	"bio" text,
	"avatar_url" text,
	"wallet_address" varchar(255),
	"status" varchar(50) DEFAULT 'DISCOVERED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"total_signals" integer DEFAULT 0 NOT NULL,
	"verified_signals" integer DEFAULT 0 NOT NULL,
	"winning_signals" integer DEFAULT 0 NOT NULL,
	"losing_signals" integer DEFAULT 0 NOT NULL,
	"win_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"average_return" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"cumulative_return" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"last_signal_at" timestamp with time zone,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"execution_mode" varchar(50) DEFAULT 'MANUAL' NOT NULL,
	"max_trade_amount" numeric(18, 4) NOT NULL,
	"max_daily_trades" integer DEFAULT 5 NOT NULL,
	"min_creator_win_rate" numeric(5, 2) DEFAULT '50.00',
	"allowed_directions" varchar(50) DEFAULT 'BOTH' NOT NULL,
	"entry_order_type" varchar(50) DEFAULT 'MARKET' NOT NULL,
	"stop_loss_percentage" numeric(5, 2),
	"take_profit_percentage" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"source_post_id" varchar(255),
	"asset_symbol" varchar(50) NOT NULL,
	"asset_address" varchar(255),
	"chain_id" varchar(50),
	"direction" varchar(10) NOT NULL,
	"entry_price" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"timeframe" varchar(50),
	"confidence" numeric(5, 2),
	"classification" varchar(50) DEFAULT 'TRADE_SIGNAL' NOT NULL,
	"signal_status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"verification_status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"entry_price" numeric(18, 8),
	"exit_price" numeric(18, 8),
	"return_percentage" numeric(10, 4),
	"outcome" varchar(50),
	"verification_method" varchar(100),
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"signal_id" uuid,
	"strategy_id" uuid,
	"provider" varchar(50) DEFAULT 'DEFINITIVE' NOT NULL,
	"provider_order_id" varchar(255),
	"chain_id" varchar(50) NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"input_token" varchar(255) NOT NULL,
	"output_token" varchar(255) NOT NULL,
	"input_amount" numeric(28, 12) NOT NULL,
	"output_amount" numeric(28, 12),
	"order_type" varchar(50) DEFAULT 'MARKET' NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING_SIGNATURE' NOT NULL,
	"transaction_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" uuid,
	"asset_address" varchar(255) NOT NULL,
	"chain_id" varchar(50) NOT NULL,
	"quantity" numeric(28, 12) NOT NULL,
	"average_entry_price" numeric(18, 8) NOT NULL,
	"current_price" numeric(18, 8),
	"unrealized_pnl" numeric(18, 4) DEFAULT '0.0000',
	"realized_pnl" numeric(18, 4) DEFAULT '0.0000',
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arkiv_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" varchar(100) NOT NULL,
	"entity_key" varchar(255) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"owner_address" varchar(255) NOT NULL,
	"related_creator_id" uuid,
	"related_signal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_metrics" ADD CONSTRAINT "creator_metrics_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_follows" ADD CONSTRAINT "creator_follows_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_verifications" ADD CONSTRAINT "signal_verifications_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD CONSTRAINT "arkiv_records_related_creator_id_creators_id_fk" FOREIGN KEY ("related_creator_id") REFERENCES "public"."creators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arkiv_records" ADD CONSTRAINT "arkiv_records_related_signal_id_signals_id_fk" FOREIGN KEY ("related_signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_address_chain_idx" ON "wallets" USING btree ("user_id","address","chain_id");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_address_idx" ON "wallets" USING btree ("address");--> statement-breakpoint
CREATE UNIQUE INDEX "creators_x_user_id_idx" ON "creators" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "creators_x_username_idx" ON "creators" USING btree ("x_username");--> statement-breakpoint
CREATE INDEX "creators_status_idx" ON "creators" USING btree ("status");--> statement-breakpoint
CREATE INDEX "creators_created_at_idx" ON "creators" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_metrics_creator_id_idx" ON "creator_metrics" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "creator_metrics_win_rate_idx" ON "creator_metrics" USING btree ("win_rate");--> statement-breakpoint
CREATE INDEX "creator_metrics_cumulative_return_idx" ON "creator_metrics" USING btree ("cumulative_return");--> statement-breakpoint
CREATE INDEX "creator_metrics_calculated_at_idx" ON "creator_metrics" USING btree ("calculated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_follows_user_creator_idx" ON "creator_follows" USING btree ("user_id","creator_id");--> statement-breakpoint
CREATE INDEX "creator_follows_user_id_idx" ON "creator_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "creator_follows_creator_id_idx" ON "creator_follows" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "strategies_user_id_idx" ON "strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategies_creator_id_idx" ON "strategies" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "strategies_status_idx" ON "strategies" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signals_source_post_id_idx" ON "signals" USING btree ("source_post_id");--> statement-breakpoint
CREATE INDEX "signals_creator_id_idx" ON "signals" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "signals_asset_symbol_idx" ON "signals" USING btree ("asset_symbol");--> statement-breakpoint
CREATE INDEX "signals_classification_idx" ON "signals" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "signals_signal_status_idx" ON "signals" USING btree ("signal_status");--> statement-breakpoint
CREATE INDEX "signals_captured_at_idx" ON "signals" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "signal_verifications_signal_id_idx" ON "signal_verifications" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "signal_verifications_status_idx" ON "signal_verifications" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "signal_verifications_outcome_idx" ON "signal_verifications" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_signal_id_idx" ON "orders" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "orders_strategy_id_idx" ON "orders" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_provider_order_id_idx" ON "orders" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "positions_user_id_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "positions_asset_address_idx" ON "positions" USING btree ("asset_address");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "arkiv_records_creator_id_idx" ON "arkiv_records" USING btree ("related_creator_id");--> statement-breakpoint
CREATE INDEX "arkiv_records_signal_id_idx" ON "arkiv_records" USING btree ("related_signal_id");--> statement-breakpoint
CREATE INDEX "arkiv_records_type_idx" ON "arkiv_records" USING btree ("record_type");--> statement-breakpoint
CREATE INDEX "arkiv_records_entity_key_idx" ON "arkiv_records" USING btree ("entity_key");