import { network } from "hardhat";
import { computeMinHash } from "../../../scripts/utils/minhash";
import { sampleNftCollection } from "../../../scripts/utils/sample-nft-collection";

export async function nftMinter() {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const [senderClient] = await viem.getWalletClients();

    const contract = await viem.deployContract("JaccardERC1155");
    console.log(`Deployed JaccardERC1155 at ${contract.address}`);

    for (let i = 0; i < sampleNftCollection.length; i++) {
        const nft = sampleNftCollection[i];
        const minHash = computeMinHash(nft) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

        const { result: tokenId } = await contract.simulate.faucet([
            senderClient.account.address,
            1n,
            minHash
        ]);
        const tx = await contract.write.faucet([
            senderClient.account.address,
            1n,
            minHash
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log(`Minted token ${tokenId}: ${nft.name}`);
    }

    return contract;
}

nftMinter();

