import hre from "hardhat";
import { parseEther } from "viem";

// Dev wallets used for manual testing in the browser - not derived from
// MNEMONIC_LOCALHOST, just funded by its first (preseeded) account. Run
// against the localhost network:
// `npx hardhat run scripts/seed-dev-wallets.ts --network localhost`
const DEV_WALLET_ADDRESSES = [
  "0x788CED731764Cf1BdBF0DA8aCEdAcA7CaE4C9997",
  "0xEbf056e97595eb4bFC80DcF8C3F3B5Be54625c24",
  "0xE8ee4dEA7146db18C4f54fd3e2367Fd3CF211e41",
] as const;
const SEED_AMOUNT_WEI = parseEther("100");

const { viem } = await hre.network.create();
const [deployer] = await viem.getWalletClients();

for (const to of DEV_WALLET_ADDRESSES) {
  const hash = await deployer.sendTransaction({ to, value: SEED_AMOUNT_WEI });
  console.log(`Sent ${SEED_AMOUNT_WEI} wei to ${to} (tx ${hash})`);
}
