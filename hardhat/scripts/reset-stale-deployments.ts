import hre from "hardhat";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

// @rocketh/deploy's skipIfAlreadyDeployed (used by 00_deploy_diamond.ts and
// 01_deploy_scrip.ts) trusts its own deployment records completely - unlike
// its deterministic (CREATE2/CREATE3) path, it never calls eth_getCode to
// confirm a recorded address still has code. Those records live under
// deployments/<network-name>/ (e.g. deployments/localhost/, keyed by the
// hardhat.config.ts network name, NOT the chain id - a separate,
// rocketh-internal bookkeeping directory from the chainId-keyed
// deployments/<chainId>/ mirror each deploy script's own saveDeployment()
// helper writes purely for shared/contracts/ generation). That's fine as
// long as the chain and these records stay in sync, but anvil's actual
// chain state lives in a Docker volume separate from this bind-mounted
// hardhat/ directory - wiping just that volume (a full local reset, or a
// fresh Sepolia fork re-pull) leaves deployments/localhost/ pointing at
// addresses that no longer exist. Left unhandled, that stale trust flows
// into diamond()'s libraries arg and its own internal facet/ABI bookkeeping
// gets confused by it, surfacing as an opaque "ABI conflict" error deep
// inside hardhat-deploy.
//
// Runs as its own process (not inline in a deploy script) deliberately:
// hardhat-deploy's Environment loads deployment records into memory once
// per `npx hardhat deploy` invocation, so deleting the files mid-run
// wouldn't necessarily be reflected in skipIfAlreadyDeployed's in-memory
// lookup. A separate prior step guarantees the deploy run that follows
// starts with a genuinely clean read from disk.
//
// Hardcoded to the "localhost" network directory since that's the only
// case this scenario applies to (see hardhat/Dockerfile, always invoked
// with --network localhost) - a real Sepolia deploy's chain state doesn't
// get wiped out from under it by our own tooling the way local anvil does.
// Run before `npx hardhat deploy`:
// `npx hardhat run scripts/reset-stale-deployments.ts --network localhost`
const NETWORK_DEPLOYMENTS_DIR = join("deployments", "localhost");

const { viem } = await hre.network.create();
const publicClient = await viem.getPublicClient();

const libEIP712Path = join(NETWORK_DEPLOYMENTS_DIR, "LibEIP712.json");

if (existsSync(libEIP712Path)) {
  const { address } = JSON.parse(readFileSync(libEIP712Path, "utf-8"));
  const code = await publicClient.getCode({ address });

  if (!code || code === "0x") {
    console.log(`Chain reset detected (${address} has no code) - clearing stale deployment records at ${NETWORK_DEPLOYMENTS_DIR}`);
    rmSync(NETWORK_DEPLOYMENTS_DIR, { recursive: true, force: true });
  } else {
    console.log(`Deployment records at ${NETWORK_DEPLOYMENTS_DIR} still match live chain state - nothing to do`);
  }
} else {
  console.log(`No prior deployment records at ${NETWORK_DEPLOYMENTS_DIR} - nothing to do`);
}
