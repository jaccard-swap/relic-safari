import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ChangeOwnershipTaskArguments {
  newOwner: string;
}

export default async function (
  taskArguments: ChangeOwnershipTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();

  const deploymentPath = join("deployments", chainId.toString(), "JaccardDiamond.json");
  const { address: diamondAddress } = JSON.parse(readFileSync(deploymentPath, "utf-8")) as {
    address: `0x${string}`;
  };

  // OwnershipFacet's ABI attached to the diamond's own address - calls route
  // through the diamond's fallback to whichever facet actually implements
  // them (see contracts/diamond/facets/OwnershipFacet.sol).
  const diamond = await viem.getContractAt("OwnershipFacet", diamondAddress);

  const previousOwner = await diamond.read.owner();
  console.log(`Current owner of JaccardDiamond (${diamondAddress}): ${previousOwner}`);

  const newOwner = taskArguments.newOwner as `0x${string}`;
  const hash = await diamond.write.transferOwnership([newOwner]);
  await publicClient.waitForTransactionReceipt({ hash });

  console.log(`Ownership transferred to ${newOwner} (tx: ${hash})`);

  return { previousOwner, newOwner, hash };
}
