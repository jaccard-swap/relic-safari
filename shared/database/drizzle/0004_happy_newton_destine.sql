CREATE TABLE "standing_bid_match_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"standing_bid_id" text NOT NULL,
	"auction_id" text NOT NULL,
	"bidder" text NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "standing_bid_match_feedback" ADD CONSTRAINT "standing_bid_match_feedback_standing_bid_id_standing_bids_id_fk" FOREIGN KEY ("standing_bid_id") REFERENCES "public"."standing_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standing_bid_match_feedback" ADD CONSTRAINT "standing_bid_match_feedback_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standing_bid_match_feedback_standing_bid_idx" ON "standing_bid_match_feedback" USING btree ("standing_bid_id");--> statement-breakpoint
CREATE INDEX "standing_bid_match_feedback_auction_idx" ON "standing_bid_match_feedback" USING btree ("auction_id");