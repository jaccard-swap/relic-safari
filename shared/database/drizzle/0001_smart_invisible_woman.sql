CREATE TABLE "trait_upgrades" (
	"id" text PRIMARY KEY NOT NULL,
	"nft_id" text NOT NULL,
	"owner" text NOT NULL,
	"chain_id" integer NOT NULL,
	"trait_key" text NOT NULL,
	"from_value" text NOT NULL,
	"to_value" text NOT NULL,
	"essence_cost" integer NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nfts" ADD COLUMN "overflow_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trait_upgrades" ADD CONSTRAINT "trait_upgrades_nft_id_nfts_id_fk" FOREIGN KEY ("nft_id") REFERENCES "public"."nfts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trait_upgrades_nft_idx" ON "trait_upgrades" USING btree ("nft_id");--> statement-breakpoint
CREATE INDEX "trait_upgrades_owner_idx" ON "trait_upgrades" USING btree ("owner");