import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { computeMinHash } from "../../scripts/utils/minhash";
import { sampleNftCollection } from "../../scripts/utils/sample-nft-collection";

/**
 * Calculate Jaccard similarity between two MinHash signatures
 * J(A,B) ≈ (number of matching hashes) / (total hashes)
 */
function jaccardSimilarity(hashA: `0x${string}`[], hashB: `0x${string}`[]): number {
    let matches = 0;
    for (let i = 0; i < hashA.length; i++) {
        if (hashA[i] === hashB[i]) {
            matches++;
        }
    }
    return matches / hashA.length;
}

describe("NFT Collection", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const [walletClient] = await viem.getWalletClients();

    it("Should mint an nft collection with minhashes and verify storage", async function () {
        const contract = await viem.deployContract("JaccardERC1155");

        // Mint each NFT with its computed minHash
        for (let i = 0; i < sampleNftCollection.length; i++) {
            const nft = sampleNftCollection[i];
            const minHash = computeMinHash(nft) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

            const { result: tokenId } = await contract.simulate.faucet([
                walletClient.account.address,
                1n,
                minHash
            ]);
            const tx = await contract.write.faucet([
                walletClient.account.address,
                1n,
                minHash
            ]);
            await publicClient.waitForTransactionReceipt({ hash: tx });

            // Verify minHash was stored correctly
            const storedHash = await contract.read.getMinHashByTokenId([tokenId]);
            for (let j = 0; j < 5; j++) {
                assert.equal(storedHash[j], minHash[j], `MinHash[${j}] mismatch for token ${tokenId}`);
            }

            // Verify balance
            const balance = await contract.read.balanceOf([walletClient.account.address, tokenId]);
            assert.equal(balance, 1n, `Balance should be 1 for token ${tokenId}`);
        }
    });

    it("Should show similar NFTs have higher Jaccard similarity", async function () {
        // Pocket Monster 1: year:2025, rarity:common, type:fire, name:Pocket Monster 1
        // Pocket Monster 3: year:2025, rarity:legendary, type:water, name:Pocket Monster 3, attributes
        // Both share year:2025 so should have some similarity

        const monster1 = sampleNftCollection[0]; // fire, common, 2025
        const monster3 = sampleNftCollection[2]; // water, legendary, 2025
        const artAlpha = sampleNftCollection[3]; // digital art, 2024

        const hash1 = computeMinHash(monster1);
        const hash3 = computeMinHash(monster3);
        const hashArt = computeMinHash(artAlpha);

        const simMonsters = jaccardSimilarity(hash1, hash3);
        const simMonsterToArt = jaccardSimilarity(hash1, hashArt);

        console.log(`Jaccard(Monster1, Monster3): ${simMonsters}`);
        console.log(`Jaccard(Monster1, ArtAlpha): ${simMonsterToArt}`);

        // Two pocket monsters should be more similar to each other than to art
        // (they share naming convention and year)
        assert.ok(
            simMonsters >= simMonsterToArt,
            `Expected monsters to be more similar to each other (${simMonsters}) than monster to art (${simMonsterToArt})`
        );
    });

    it("Should show identical NFTs have Jaccard similarity of 1", async function () {
        const nft = sampleNftCollection[0];
        const hash1 = computeMinHash(nft);
        const hash2 = computeMinHash(nft);

        const similarity = jaccardSimilarity(hash1, hash2);
        assert.equal(similarity, 1, "Identical NFTs should have Jaccard similarity of 1");
    });
});
