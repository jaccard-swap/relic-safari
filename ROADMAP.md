# Roadmap: Sepolia Testnet Deployment

Checklist of what's needed to get Relic Safari running publicly on Sepolia
(chain 11155111). "Production" here means Sepolia testnet, not mainnet.

## Contracts

- [ ] Run `00_deploy_diamond.ts` against `--network sepolia` to deploy the
      current Diamond architecture (facets incl. Essence/Polymerase).
      The Sepolia contracts currently checked in under
      `shared/contracts/11155111/` are from the old pre-diamond
      `deploy-auction` task and are missing the Essence facet entirely -
      nothing on today's Sepolia matches what runs on localhost/31337.
- [ ] Update the hardcoded metadata base URI in `00_deploy_diamond.ts`
      (currently `https://api.jaccardswap.xyz/metadata/{id}.json`, old
      branding, doesn't reference `DOMAIN_NAME`) before the init call bakes
      it into the new deployment.
- [ ] Decide whether `hardhat/tasks/deploy-auction.ts` (the legacy
      standalone-contract deploy path used for the current stale Sepolia
      deployment) should be deleted now that `00_deploy_diamond.ts` is the
      real path, to avoid two divergent deploy flows.
- [ ] Verify the new diamond + facets on Sepolia Etherscan
      (`hardhat-verify` is already wired via `ETHERSCAN_API_KEY`).
- [ ] Fund the relayer/sponsor wallet (`MNEMONIC` account index 0, same
      account hardhat deploys from) with Sepolia ETH - there's currently no
      script or check for this, it's a manual step before sponsored
      transactions will work at all.

## API / Backend

- [ ] Set real `SEPOLIA_RPC_URL`, `MNEMONIC`, `ETHERSCAN_API_KEY` in the
      deployed environment (current `.env`/`.env.example` values are
      placeholders - too short to be real).
- [ ] Set a real `JWT_SECRET` (currently empty in `.env`; the API already
      throws at boot in production if this is unset, which is correct, but
      it needs an actual value supplied).
- [ ] Add CORS configuration scoped to the real deployed frontend origin -
      there is currently no CORS plugin/policy anywhere in the API.
- [ ] Confirm `NODE_ENV=production` is set wherever this actually deploys
      (it gates the faucet's per-wallet rate limit -
      `api/src/routes/faucet/index.ts:637` - and the `JWT_SECRET` fallback).
- [ ] Decide whether to pass a `domain` to `verifySiweMessage` in
      `api/src/routes/auth/index.ts` - currently unchecked, which is a
      replay-across-origins concern once this is reachable on a public
      domain.
- [ ] Either wire up Redis (provisioned in dev compose, referenced nowhere
      in `api/src` today) for whatever it was intended for (e.g. multi-instance
      auction rooms), or drop it from the prod topology as dead infra.
- [ ] Add a `web` (and/or decide on `farcaster`) service to
      `docker-compose.prod.yaml` - only the farcaster mini-app currently has
      a prod deployment path; the main React Router frontend has none.
- [ ] Look at the one real TODO found in the codebase:
      `api/src/lib/Auction/db.ts:297` ("Add preflight checks") - judge
      whether it's blocking before going live with real auctions.

## Frontend

- [ ] Wire up `VITE_SEPOLIA_RPC_URL` in `web/` - it's already passed through
      by `docker-compose.dev.yaml` but nothing in `web/app` or
      `wagmi.ts` reads it, so Sepolia reads currently fall back to wagmi's
      default public RPC instead of a dedicated provider.
- [ ] Re-point `web/app/lib/contracts.ts`'s `11155111` registry entry at the
      addresses produced by the fresh diamond deploy above.
- [ ] Decide if the Farcaster mini-app (`farcaster/`, targets **Base
      Sepolia**, a different chain entirely from `web`/`api`/`hardhat`'s
      Ethereum Sepolia) is in scope for this deployment. If so it needs its
      own contract deploy + API chain support (`SupportedChainId` doesn't
      include Base Sepolia today).

## Database

- [ ] Run `db:setup:prod` (drizzle migrate + admin seed) against the real
      Postgres instance - this is already scripted and repeatable via
      `docker-compose.prod.yaml`'s `db-setup` service, just needs
      `DATABASE_URL`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_USERNAME` set.
- [ ] Remember to run `db:generate` (drizzle-kit generate) and commit the
      migration any time `shared/database/src/db/schema.ts` changes before
      this deploy - `db:migrate` only picks up committed migration files.

## Docs

- [ ] Rewrite the Sepolia deploy instructions in `README.md` and
      `hardhat/README.md` - both are stale hardhat-template boilerplate
      (reference `ignition/modules/Counter.ts` and `SEPOLIA_PRIVATE_KEY`,
      neither of which matches the actual `hardhat-deploy`/`MNEMONIC` flow
      this repo uses).

## Later / explicitly deferred

- [ ] ERC-7730 clear-signing descriptor for the `JaccardERC1155Permit` /
      `Bid` / `Auction` EIP-712 types, so wallets stop showing the "no clear
      sign translation" warning on signature prompts.
- [ ] CI (no `.github/workflows/` or equivalent exists today - nothing
      currently gates merges on tests/lint/build).
