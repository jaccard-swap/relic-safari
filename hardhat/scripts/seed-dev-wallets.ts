import hre from "hardhat";
import { createWalletClient, http, parseEther } from "viem";
import { hardhat as hardhatChain } from "viem/chains";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
// uses to mint Essence for seeding.
const DEV_ESSENCE_AMOUNT = parseEther("500");

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

for (const to of DEV_WALLET_ADDRESSES) {
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
}
