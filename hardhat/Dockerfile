FROM node:25

WORKDIR /app

# Copy root package.json for workspace setup
COPY package.json package-lock.json ./
COPY hardhat/package.json ./hardhat/
# scripts/seed-dev-wallets.ts imports @shared/constants (TRAIT_POOLS,
# computeMinHash) as a real npm-workspace package, not a bind-mounted JSON
# file like @shared/contracts is - its package.json has to exist before
# `npm install` for the workspace symlink to resolve at all, same pattern
# api/Dockerfile.dev already uses for its own shared/* deps.
COPY shared/constants/package.json ./shared/constants/

# Install all dependencies from root (workspace linking)
RUN npm install

# shared/contracts is read directly via bind-mounted JSON files at runtime
# (see docker-compose.dev.yaml), never imported as an npm package, so unlike
# shared/constants below it doesn't need copying/building here.
COPY shared/constants ./shared/constants
WORKDIR /app/shared/constants
RUN npm run build

WORKDIR /app
# Copy source files
COPY hardhat ./hardhat

WORKDIR /app/hardhat

# reset-stale-deployments.ts runs first: if anvil's chain state got wiped
# (its Docker volume is separate from this bind-mounted hardhat/ directory,
# so the two can desync - e.g. a `docker compose down -v`) but
# deployments/<chainId>/ wasn't, hardhat-deploy's skipIfAlreadyDeployed would
# otherwise blindly trust those now-invalid addresses and crash deep inside
# diamond()'s internals with an opaque ABI-conflict error. See the script's
# own comments for why this has to run as a separate step beforehand rather
# than a check inside a deploy script.
#
# --skip-prompts: hardhat-deploy asks an interactive "gas price may change,
# proceed?" confirmation before any deployment tx, which hangs forever with
# no stdin attached in a non-interactive `docker compose up`. No --reset:
# anvil's chain state persists (see the anvil service's --state volume), so
# the deploy script only redeploys what isn't already live there.
# seed-dev-wallets.ts is safe to re-run too, though not a strict no-op: it
# re-sends ETH (harmless, the preseeded deployer has far more than it'll
# ever hand out), re-claims each dev wallet's Scrip faucet (cooldown-free on
# chain 31337 - see Scrip.sol - so this just tops the balance up further
# each run), and mints another round of dev-convenience Essence each time
# (Essence has no public faucet by design, so this is a plain owner mint,
# not idempotency-guarded - each run simply adds more). create-uniswap-pool.ts
# is its own self-contained script (not a deploy/ migration - Uniswap is a
# vendor integration we don't deploy, just point at the real, already-live
# Factory/Router - see the script's own comments) and is a true no-op on
# repeat runs: skips creating the pair if it already exists, skips seeding
# if the pool already has liquidity.
CMD ["sh", "-c", "npx hardhat run scripts/reset-stale-deployments.ts --network localhost && npx hardhat deploy --network localhost --skip-prompts && npx hardhat run scripts/seed-dev-wallets.ts --network localhost && npx hardhat run scripts/create-uniswap-pool.ts --network localhost"]
