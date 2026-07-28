import hre from "hardhat";
import { createWalletClient, http, parseEther } from "viem";
import { hardhat as hardhatChain } from "viem/chains";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TRAIT_POOLS, computeMinHash } from "@shared/constants";

// Dev wallets used for manual testing in the browser - not derived from
// MNEMONIC_LOCALHOST, just funded by its first (preseeded) account. Run
// against the localhost network:
// `npx hardhat run scripts/seed-dev-wallets.ts --network localhost`
const DEV_WALLET_ADDRESSES = [
  "0x788CED731764Cf1BdBF0DA8aCEdAcA7CaE4C9997",
  "0xEbf056e97595eb4bFC80DcF8C3F3B5Be54625c24",
  "0xE8ee4dEA7146db18C4f54fd3e2367Fd3CF211e41",
  "0xD35B081711ca79A3ab8C933DAAA8648C7a1bbcfd",
] as const;
const SEED_AMOUNT_WEI = parseEther("100");
// Dev-convenience starting balance - Essence has no public faucet by design
// (earned via Forge/Polymerase), so this mints directly via the deployer's
// diamond-owner privileges, same mechanism create-uniswap-pool.ts already
// uses to mint Essence for seeding. Sized to comfortably cover Forge's
// steep direct-upgrade costs (api/src/lib/traitUpgrades.ts's
// FORGE_COST_MULTIPLIER) during manual testing, not just Polymerase's
// cheaper fuse-yield economy.
const DEV_ESSENCE_AMOUNT = parseEther("20000");
// api/src/routes/nft/index.ts's dev-only POST /nft/seed - see seedCupboardNfts
// below. Same URL the web container uses to reach the api service by Docker
// DNS name; falls back to localhost for a host-run script.
const API_URL = process.env.VITE_API_URL ?? "http://localhost:3000";

const { viem } = await hre.network.create();
const [deployer] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();
// anvil-specific test actions (impersonateAccount et al.) - this project
// always talks to the standalone anvil binary for chain 31337, not
// hardhat's own EDR network, so mode is pinned rather than auto-detected.
const testClient = await viem.getTestClient({ mode: "anvil" });
const chainId = await publicClient.getChainId();

function loadDeployed(name: string) {
  const path = join("..", "shared", "contracts", chainId.toString(), `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

const scrip = loadDeployed("Scrip");
const essence = loadDeployed("Essence");
const jaccardErc1155 = loadDeployed("JaccardERC1155");

// The api container has no depends_on: api ordering against this deploy
// container (see docker-compose.dev.yaml) - it may not have finished
// booting yet, so this retries instead of assuming it's already reachable.
// Non-fatal even after every attempt fails: the on-chain artifact still
// exists either way, just without a Postgres row (and therefore invisible
// to Museum/Vault/etc.) until this script is re-run.
async function seedNftRecord(body: { owner: string; chainId: number; metadata: Record<string, string>; tokenId: string }) {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_URL}/nft/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API responded ${res.status}: ${await res.text()}`);
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.warn(`Could not seed DB record for tokenId ${body.tokenId} after ${maxAttempts} attempts (${err}) - re-run this script once the api service is up.`);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// One ready-to-freeze Museum cupboard per dev wallet - 7 artifacts (one per
// Form), all sharing one Site+Age+Material combination and all maxed on
// every upgradeable trait (isFullyMaxed(), see api/src/lib/traitUpgrades.ts)
// so /museum/complete-cupboard works immediately instead of requiring a
// long dig/Forge grind just to get a testable cupboard. Combination varies
// per wallet (indexed into the trait pools) purely for variety when eyeballing
// the Museum grid across dev accounts - it has no other significance.
const MAX_RARITY = TRAIT_POOLS.rarity.values.at(-1)!.value;
const MAX_QUALITY = TRAIT_POOLS.quality.values.at(-1)!.value;
const MAX_INSCRIPTION = TRAIT_POOLS.inscription.values.at(-1)!.value;
const FORMS = TRAIT_POOLS.form.values.map((v) => v.value);

async function seedCupboardNfts(to: string, walletIndex: number) {
  const site = TRAIT_POOLS.site.values[walletIndex % TRAIT_POOLS.site.values.length].value;
  const age = TRAIT_POOLS.age.values[walletIndex % TRAIT_POOLS.age.values.length].value;
  const material = TRAIT_POOLS.material.values[walletIndex % TRAIT_POOLS.material.values.length].value;

  for (const form of FORMS) {
    const metadata = {
      name: `${material} ${form}`,
      rarity: MAX_RARITY,
      age,
      quality: MAX_QUALITY,
      material,
      form,
      site,
      inscription: MAX_INSCRIPTION,
    };
    const minHash = computeMinHash(metadata);

    const { result: tokenId } = await publicClient.simulateContract({
      address: jaccardErc1155.address,
      abi: jaccardErc1155.abi,
      functionName: "faucet",
      args: [to, 1n, minHash],
      account: deployer.account.address,
    }) as { result: bigint };

    const mintHash = await deployer.writeContract({
      address: jaccardErc1155.address,
      abi: jaccardErc1155.abi,
      functionName: "faucet",
      args: [to, 1n, minHash],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });

    await seedNftRecord({ owner: to, chainId, metadata, tokenId: tokenId.toString() });
  }
  console.log(`Seeded a ready-to-freeze cupboard (${material} / ${age} / ${site}) for ${to}`);
}

for (const [walletIndex, to] of DEV_WALLET_ADDRESSES.entries()) {
  const hash = await deployer.sendTransaction({ to, value: SEED_AMOUNT_WEI });
  console.log(`Sent ${SEED_AMOUNT_WEI} wei to ${to} (tx ${hash})`);

  // Scrip.faucet() mints to msg.sender - impersonate each dev wallet
  // (anvil-only, no real private key needed) so it can claim its own
  // stipend directly. The 12h cooldown is skipped entirely on chain 31337
  // (see Scrip.sol) - still true under the Sepolia fork, since anvil's
  // --chain-id override is a real EVM-level override that block.chainid
  // reflects inside the contract, not just a cosmetic RPC response.
  await testClient.impersonateAccount({ address: to });
  const impersonated = createWalletClient({ account: to, chain: hardhatChain, transport: http(process.env.LOCALHOST_RPC_URL) });
  const faucetHash = await impersonated.writeContract({ address: scrip.address, abi: scrip.abi, functionName: "faucet", args: [] });
  await publicClient.waitForTransactionReceipt({ hash: faucetHash });
  await testClient.stopImpersonatingAccount({ address: to });
  console.log(`Claimed Scrip faucet for ${to} (tx ${faucetHash})`);

  const mintHash = await deployer.writeContract({
    address: essence.address,
    abi: essence.abi,
    functionName: "mint",
    args: [to, DEV_ESSENCE_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`Minted ${DEV_ESSENCE_AMOUNT} Essence to ${to} (tx ${mintHash})`);

  await seedCupboardNfts(to, walletIndex);
}
