import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface DeployAuctionTaskArguments {
  verify: boolean;
  noCompile: boolean;
  testTokens: boolean;
  saveDeployments: boolean;
}

async function saveDeployment(
  hre: HardhatRuntimeEnvironment,
  chainId: bigint,
  contractName: string,
  address: string,
) {
  const artifact = await hre.artifacts.readArtifact(contractName);
  const dir = join("deployments", chainId.toString());
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${contractName}.json`),
    JSON.stringify({ address, abi: artifact.abi }, null, 2),
  );
  console.log(`Saved ${contractName}.json to ${dir}/`);
}

export default async function (
  taskArguments: DeployAuctionTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  if (!taskArguments.noCompile) {
    await hre.tasks.getTask(["compile"]).run();
  }

    const verify = hre.tasks.getTask(["verify"]);

    const { viem } = await hre.network.connect();
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();

    const auction = await viem.deployContract("JaccardSwap");
    console.log(`Deployed JaccardSwap at ${auction.address}`);

    if (taskArguments.saveDeployments) {
      await saveDeployment(hre, BigInt(chainId), "JaccardSwap", auction.address);
    }

    // Wait for block explorer to index the contract
    console.log("Waiting 3.5s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 3500));

    await verify.run({address: auction.address});
    
    if (taskArguments.testTokens) {
        const scrip = await viem.deployContract("Scrip");
        console.log(`Deployed Scrip at ${scrip.address}`);

        await scrip.write.faucet();
        console.log("Fauceted Scrip");

        const jaccardNft = await viem.deployContract("JaccardERC1155");
        console.log(`Deployed JaccardERC1155 at ${jaccardNft.address}`);

        if (taskArguments.saveDeployments) {
            await saveDeployment(hre, BigInt(chainId), "Scrip", scrip.address);
            await saveDeployment(hre, BigInt(chainId), "JaccardERC1155", jaccardNft.address);
        }

        // Wait for block explorer to index the contract
        console.log("Waiting 3.5s for block explorer indexing...");
        await new Promise((r) => setTimeout(r, 3500));

        if (taskArguments.verify) {
            await Promise.all([
                verify.run({address: scrip.address}),
                verify.run({address: jaccardNft.address}),
            ]);
        }

        return {
            auction: auction.address,
            scrip: scrip.address,
            jaccardNft: jaccardNft.address,
        }
    }
    return {
        auction: auction.address,
    }
}