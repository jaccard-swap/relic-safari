import hre from "hardhat";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseEther, zeroAddress } from "viem";

const require = createRequire(import.meta.url);

// Uniswap V2's real Sepolia deployment - verified on-chain (not guessed):
// router.factory() on this Router02 returns exactly this Factory address,
// and factory.allPairsLength() is in the tens of thousands, confirming
// this is the actual live, heavily-used instance (per
// developers.uniswap.org/docs/protocols/v2/deployments). Local anvil forks
// Sepolia (see docker-compose.dev.yaml's anvil --fork-url), so the same
// addresses resolve to the same real contracts there too under the
// chain-id-31337 override - one code path for both.
const UNISWAP_V2: Record<number, { factory: `0x${string}`; router: `0x${string}` }> = {
  11155111: { factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6", router: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3" },
  31337: { factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6", router: "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3" },
};

// We hit the real, already-deployed Uniswap V2 (see UNISWAP_V2 above) -
// this script only creates the Scrip/Essence pair on it and seeds initial
// liquidity, both one-time operational actions, not deployment. Run
// directly with: `npx hardhat run scripts/create-uniswap-pool.ts --network localhost`
//
// 1,000,000 each, a 1:1 starting ratio - matches Scrip.sol's unconditional
// constructor pre-mint (the deployer's only fast source of Scrip on a real
// chain, where the faucet's cooldown/cap make reaching this amount that way
// impractical) and an equal owner-minted amount of Essence below.
const SEED_SCRIP = parseEther("1000000");
const SEED_ESSENCE = parseEther("1000000");

function contractsDir(chainId: number) {
  return join("..", "shared", "contracts", chainId.toString());
}

function loadDeployed(chainId: number, name: string): { address: `0x${string}`; abi: any } {
  const path = join(contractsDir(chainId), `${name}.json`);
  if (!existsSync(path)) throw new Error(`${name} not deployed on chain ${chainId} yet`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveDeployment(chainId: number, name: string, address: string, abi: any) {
  const dir = contractsDir(chainId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify({ address, abi }, null, 2));
  console.log(`Saved ${name}.json`);
}

function loadUniswapAbi(pkg: "v2-core" | "v2-periphery", name: string) {
  const path = require.resolve(`@uniswap/${pkg}/build/${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")).abi;
}

const { viem } = await hre.network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const chainId = await publicClient.getChainId();

const addresses = UNISWAP_V2[chainId];
if (!addresses) throw new Error(`No known Uniswap V2 deployment for chain ${chainId}`);

const factory = { address: addresses.factory, abi: loadUniswapAbi("v2-core", "UniswapV2Factory") };
const router = { address: addresses.router, abi: loadUniswapAbi("v2-periphery", "UniswapV2Router02") };
saveDeployment(chainId, "UniswapV2Factory", factory.address, factory.abi);
saveDeployment(chainId, "UniswapV2Router02", router.address, router.abi);

const scrip = loadDeployed(chainId, "Scrip");
const essence = loadDeployed(chainId, "Essence");

// createPair reverts PAIR_EXISTS on a second call - read first so this
// script stays safe to run every time.
let pairAddress = (await publicClient.readContract({
  address: factory.address,
  abi: factory.abi,
  functionName: "getPair",
  args: [scrip.address, essence.address],
})) as `0x${string}`;

if (pairAddress === zeroAddress) {
  const hash = await deployer.writeContract({
    address: factory.address,
    abi: factory.abi,
    functionName: "createPair",
    args: [scrip.address, essence.address],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  pairAddress = (await publicClient.readContract({
    address: factory.address,
    abi: factory.abi,
    functionName: "getPair",
    args: [scrip.address, essence.address],
  })) as `0x${string}`;
  console.log(`Created Scrip/Essence pair at ${pairAddress}`);
} else {
  console.log(`Reusing Scrip/Essence pair at ${pairAddress}`);
}

const pairAbi = loadUniswapAbi("v2-core", "UniswapV2Pair");
saveDeployment(chainId, "ScripEssencePair", pairAddress, pairAbi);

// Seed initial liquidity once, guarded on reserves still being zero. This
// mints real Essence supply and sets a starting price - a game-economy
// decision, not just plumbing, so it's worth reviewing explicitly before
// this ever runs anywhere beyond local anvil.
const reserves = (await publicClient.readContract({
  address: pairAddress,
  abi: pairAbi,
  functionName: "getReserves",
})) as [bigint, bigint, number];

if (reserves[0] > 0n || reserves[1] > 0n) {
  console.log("Pool already has liquidity, skipping seed");
} else {
  const scripBalance = (await publicClient.readContract({
    address: scrip.address,
    abi: scrip.abi,
    functionName: "balanceOf",
    args: [deployer.account.address],
  })) as bigint;

  if (scripBalance < SEED_SCRIP) {
    // On a real chain, Scrip's only per-account supply is a tiny
    // rate-limited faucet claim - the deployer won't hold enough to seed a
    // pool right after a fresh deploy. Skip rather than fail; re-run once
    // funded (the zero-reserves check above keeps that safe).
    console.log(`Deployer has ${scripBalance} Scrip, need ${SEED_SCRIP} to seed - skipping initial liquidity for now`);
  } else {
    let hash = await deployer.writeContract({
      address: essence.address,
      abi: essence.abi,
      functionName: "mint",
      args: [deployer.account.address, SEED_ESSENCE],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    hash = await deployer.writeContract({
      address: scrip.address,
      abi: scrip.abi,
      functionName: "approve",
      args: [router.address, SEED_SCRIP],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    hash = await deployer.writeContract({
      address: essence.address,
      abi: essence.abi,
      functionName: "approve",
      args: [router.address, SEED_ESSENCE],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    hash = await deployer.writeContract({
      address: router.address,
      abi: router.abi,
      functionName: "addLiquidity",
      args: [scrip.address, essence.address, SEED_SCRIP, SEED_ESSENCE, 0n, 0n, deployer.account.address, deadline],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    console.log(`Seeded initial liquidity: ${SEED_SCRIP} Scrip / ${SEED_ESSENCE} Essence`);
  }
}
