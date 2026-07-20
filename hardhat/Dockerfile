FROM node:25

WORKDIR /app

# Copy root package.json for workspace setup
COPY package.json package-lock.json ./
COPY hardhat/package.json ./hardhat/

# Install all dependencies from root (workspace linking)
RUN npm install

# Copy source files
COPY hardhat ./hardhat

WORKDIR /app/hardhat

# --skip-prompts: hardhat-deploy asks an interactive "gas price may change,
# proceed?" confirmation before any deployment tx, which hangs forever with
# no stdin attached in a non-interactive `docker compose up`. No --reset:
# anvil's chain state persists (see the anvil service's --state volume), so
# the deploy script only redeploys what isn't already live there. The seed
# script re-sends ETH to the dev wallets on every run too, but that's a
# no-op cost, not a correctness issue - anvil's preseeded deployer account
# has far more than it'll ever hand out.
CMD ["sh", "-c", "npx hardhat deploy --network localhost --skip-prompts && npx hardhat run scripts/seed-dev-wallets.ts --network localhost"]
