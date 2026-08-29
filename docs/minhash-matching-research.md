# Research: coverage-based standing-bid matching

Status: **not implemented**. Written up so the direction is on record; not scoped into the 2026-08-29 standing-buy-order pass (auctioneer scan button, honest threshold labeling, match-feedback signal).

## The primitive today

Standing buy orders match against auction listings via MinHash similarity:

- `computeMinHash(traits)` (`shared/constants/src/index.ts`) hashes a buyer's chosen `key:value` trait pairs (or an NFT's full metadata) into a 20-band signature (`bytes8[20]`), using `MINHASH_BANDS` independent seeds.
- `countMinHashMatches(a, b)` counts how many of the 20 bands are identical between two signatures — a MinHash estimate of the *Jaccard similarity* between the two underlying feature sets.
- `minMatches` (2–20) is the threshold a standing bid's signature must clear against an item's signature to count as a match. This is enforced both off-chain (`api/src/lib/Auction/standingBids.ts`) and on-chain (`_isBidValid`/`countMatches` in `hardhat/contracts/diamond/facets/JaccardSwapFacet.sol`).

## The problem

Jaccard similarity is symmetric and size-sensitive: for a buyer's trait set `A` (size `n_A`) and an item's trait set `B` (size `n_B`), when every trait in `A` is literally present in `B` (the buyer's wishlist is fully satisfied),

```
Jaccard(A, B) = k / (n_A + n_B − k)
```

where `k` is the number of matching traits (here, `k = n_A`, since everything the buyer asked for is satisfied). This score depends on `n_B` — the item's *own* trait count — which the buyer never chose and doesn't care about.

Item trait counts in this game are not fixed. NFTs mint with a deliberately random count, 1–7 categories, Gaussian-weighted toward 4–5 (`api/src/routes/faucet/index.ts:735-745`) — an intentional rarity/completeness mechanic for the excavation game, not an oversight. So the *same* buyer intent — "everything I asked for is present" — scores differently depending entirely on how many extra, buyer-irrelevant traits the matched item happens to have. No single `minMatches` threshold can express "did this item satisfy what I asked for" consistently across real inventory; it's always too strict against trait-rich items or too loose against sparse ones.

(We initially considered fixing this by requiring buyers to fully specify all 7 trait categories, so both sides of the comparison would be equal-sized. That doesn't hold up: most minted items don't have 7 traits, so a buyer's full-7 wishlist would rarely align with real inventory's actual shape — it just relocates the mismatch rather than fixing it.)

## The alternative: coverage score

Define match quality as

```
coverage = k / n_A
```

— the fraction of the *buyer's own* requested traits the item actually satisfies, ignoring `n_B` entirely. This is monotonic and predictable from the buyer's perspective:

- Satisfying an additional requested trait can only help.
- Failing a requested trait always hurts.
- Removing a requirement the item doesn't meet always helps.

That last property is the actual "loosen my criteria" intuition a buyer reaches for when nothing matches — and it's exactly what the current symmetric-Jaccard primitive gets backwards (removing a trait from a partial wishlist *lowers* the expected match score against a full item, not raises it).

## What it would take

Two possible implementations:

**(a) Exact per-trait check, off-chain.** Compare the buyer's specific requested `key:value` pairs directly against the item's stored metadata (already in Postgres). No hashing involved, trivial to compute — but has no on-chain equivalent, since the chain only ever sees opaque MinHash bytes, never raw trait data. This would decouple buy-order matching from the cryptographically-committed `Bid.targetMinHash`/`minMatches` entirely: today the signed `Bid` *is* the match criterion; under this approach it becomes advisory only, with the real check happening off-chain.

**(b) Fixed-positional band hashing.** Redesign `computeMinHash` so each of the 7 trait categories always occupies a fixed band (using a canonical "absent" sentinel for a category the item or buyer doesn't have), instead of hashing a variable-length feature list. Band `i` then always corresponds to category `i`, and a literal per-band match becomes a real per-category signal — closer to true coverage semantics, while still fitting the existing `bytes8[20]` on-chain shape.

Notably, **`JaccardSwapFacet.sol`'s `countMatches`/`_isBidValid` likely wouldn't need to change under option (b)** — the contract only ever compares two pre-computed `bytes8[20]` arrays band-by-band; it has no opinion on how they were derived. That makes (b) plausibly a `shared/constants` + off-chain change only, no redeploy — worth confirming once this is actually scoped as real work.

## Before committing to either

**Blast radius.** `computeMinHash`/`countMinHashMatches` are shared beyond standing bids — `api/src/lib/polymerase.ts` and `api/src/routes/forge/index.ts` also reference `TRAIT_POOLS` and likely lean on the same similarity primitive for Polymerase fusion matching. Changing the algorithm globally could shift behavior there too. This needs its own investigation (does Polymerase/Forge depend on the current variable-length-feature-list behavior in a way that would break?) before scoping real work.

**Data migration.** Every existing `nfts.minHash` and `standingBids.targetMinHash` value in the DB is computed under the current scheme. A scheme change means either:
- a recompute pass (cheap — deterministic from already-stored metadata), or
- running old and new schemes side by side as a v1/v2 split.

Existing signed `Bid` EIP-712 signatures commit to the *old* `bytes8[20]` values, so old standing bids' signatures stay valid for what they signed — but their *match semantics* would shift under a new scheme. That realistically means treating this as a v2 matching scheme, run alongside v1, rather than silently reinterpreting v1 data under new rules.

## Recommendation

Worth pursuing as its own follow-up initiative once there's a signal that it's worth the investment (see the match-feedback signal shipped alongside this doc — `standingBidMatchFeedback` in `shared/database/src/db/schema.ts`, surfaced in the Bazaar page). Scope starts with confirming Polymerase/Forge's coupling to the current MinHash behavior, then choosing between (a) and (b) above.
