CREATE TABLE "cupboard_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"chain_id" integer NOT NULL,
	"site" text NOT NULL,
	"age" text NOT NULL,
	"material" text NOT NULL,
	"cupboard_key" text NOT NULL,
	"nft_ids" jsonb NOT NULL,
	"points" integer NOT NULL,
	"badge_id" text,
	"tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cupboard_completions_owner_idx" ON "cupboard_completions" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "cupboard_completions_cupboard_idx" ON "cupboard_completions" USING btree ("cupboard_key");--> statement-breakpoint
CREATE UNIQUE INDEX "cupboard_completions_owner_cupboard_unique" ON "cupboard_completions" USING btree ("owner","cupboard_key") WHERE status = 'success';