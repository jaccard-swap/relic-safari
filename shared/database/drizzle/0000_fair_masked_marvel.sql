CREATE TABLE "auctions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"nft_id" text,
	"nft_contract" text NOT NULL,
	"nft_token_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"token_contract" text NOT NULL,
	"starting_bid" text NOT NULL,
	"end_time" timestamp NOT NULL,
	"auctioneer" text NOT NULL,
	"salt" text,
	"signature" text,
	"auctioneer_nonce" text,
	"nft_permit" jsonb,
	"nft_permit_signature" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"winner" text,
	"winning_bid" text,
	"settlement_tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_bid_check" timestamp
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" text PRIMARY KEY NOT NULL,
	"auction_id" text NOT NULL,
	"bidder" text NOT NULL,
	"amount" text NOT NULL,
	"salt" text,
	"deadline" timestamp,
	"target_min_hash" jsonb,
	"min_matches" integer,
	"erc20_permit" jsonb,
	"signature" text,
	"bid_sig_hash" text,
	"bidder_nonce" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"auction_id" text NOT NULL,
	"sender" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nfts" (
	"id" text PRIMARY KEY NOT NULL,
	"token_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text NOT NULL,
	"recipient" text NOT NULL,
	"tx_hash" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"min_hash" jsonb NOT NULL,
	"trait_levels" jsonb DEFAULT '{}',
	"polymerization_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polymerizations" (
	"id" text PRIMARY KEY NOT NULL,
	"target_nft_id" text NOT NULL,
	"consumed_nft_id" text NOT NULL,
	"owner" text NOT NULL,
	"chain_id" integer NOT NULL,
	"upgraded_traits" jsonb NOT NULL,
	"experience_gained" jsonb DEFAULT '{}',
	"essence_yield" integer DEFAULT 0 NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsorship_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"chain_id" integer NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"nft_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standing_bids" (
	"id" text PRIMARY KEY NOT NULL,
	"bidder" text NOT NULL,
	"chain_id" integer NOT NULL,
	"amount" text NOT NULL,
	"target_min_hash" jsonb NOT NULL,
	"min_matches" integer DEFAULT 3 NOT NULL,
	"desired_traits" jsonb NOT NULL,
	"salt" text NOT NULL,
	"deadline" timestamp NOT NULL,
	"signature" text NOT NULL,
	"erc20_permit" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"matched_auction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_nft_id_nfts_id_fk" FOREIGN KEY ("nft_id") REFERENCES "public"."nfts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polymerizations" ADD CONSTRAINT "polymerizations_target_nft_id_nfts_id_fk" FOREIGN KEY ("target_nft_id") REFERENCES "public"."nfts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polymerizations" ADD CONSTRAINT "polymerizations_consumed_nft_id_nfts_id_fk" FOREIGN KEY ("consumed_nft_id") REFERENCES "public"."nfts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorship_requests" ADD CONSTRAINT "sponsorship_requests_nft_id_nfts_id_fk" FOREIGN KEY ("nft_id") REFERENCES "public"."nfts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_bids" ADD CONSTRAINT "standing_bids_matched_auction_id_auctions_id_fk" FOREIGN KEY ("matched_auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auctions_auctioneer_idx" ON "auctions" USING btree ("auctioneer");--> statement-breakpoint
CREATE INDEX "auctions_status_idx" ON "auctions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auctions_end_time_idx" ON "auctions" USING btree ("end_time");--> statement-breakpoint
CREATE INDEX "auctions_chain_idx" ON "auctions" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "bids_auction_idx" ON "bids" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "bids_bidder_idx" ON "bids" USING btree ("bidder");--> statement-breakpoint
CREATE INDEX "bids_amount_idx" ON "bids" USING btree ("amount");--> statement-breakpoint
CREATE INDEX "chats_auction_idx" ON "chats" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "chats_created_idx" ON "chats" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nfts_token_id_chain_idx" ON "nfts" USING btree ("token_id","chain_id");--> statement-breakpoint
CREATE INDEX "nfts_recipient_idx" ON "nfts" USING btree ("recipient");--> statement-breakpoint
CREATE INDEX "nfts_status_idx" ON "nfts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "polymerizations_target_idx" ON "polymerizations" USING btree ("target_nft_id");--> statement-breakpoint
CREATE INDEX "polymerizations_owner_idx" ON "polymerizations" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "polymerizations_status_idx" ON "polymerizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sponsorship_recipient_created_idx" ON "sponsorship_requests" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_recipient_type_idx" ON "sponsorship_requests" USING btree ("recipient","request_type");--> statement-breakpoint
CREATE INDEX "standing_bids_bidder_idx" ON "standing_bids" USING btree ("bidder");--> statement-breakpoint
CREATE INDEX "standing_bids_status_idx" ON "standing_bids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "standing_bids_chain_idx" ON "standing_bids" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "standing_bids_deadline_idx" ON "standing_bids" USING btree ("deadline");