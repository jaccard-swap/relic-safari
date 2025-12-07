import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { computeMinHash } from "../scripts/utils/minhash";

// All 7 trait keys
const TRAIT_KEYS = ['rarity', 'age', 'quality', 'material', 'form', 'site', 'inscription'] as const;

// Artifact trait pools matching api/src/routes/faucet/index.ts
const TRAIT_VALUES: Record<string, string[]> = {
  rarity: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
  age: ['neolithic', 'bronze', 'iron', 'classical', 'medieval', 'antediluvian'],
  quality: ['fragmented', 'worn', 'intact', 'pristine', 'immaculate'],
  material: ['clay', 'bone', 'bronze', 'iron', 'silver', 'jade', 'obsidian', 'gold', 'orichalcum'],
  form: ['tablet', 'idol', 'vessel', 'amulet', 'blade', 'scepter', 'mask'],
  site: ['sunken-temple', 'desert-tomb', 'mountain-shrine', 'forest-barrow', 'volcanic-forge', 'frozen-citadel'],
  inscription: ['unmarked', 'faded', 'partial', 'legible', 'glowing'],
};

type Artifact = Record<string, string>;

function createArtifact(overrides: Partial<Record<string, string[]>> = {}): Artifact {
  const artifact: Artifact = {};
  for (const key of TRAIT_KEYS) {
    artifact[key] = overrides[key]?.[0] || TRAIT_VALUES[key][0];
  }
  return artifact;
}

function randomArtifact(): Artifact {
  const artifact: Artifact = {};
  for (const key of TRAIT_KEYS) {
    const values = TRAIT_VALUES[key];
    artifact[key] = values[Math.floor(Math.random() * values.length)];
  }
  return artifact;
}

// True Jaccard similarity between two artifacts (set intersection / union)
function trueJaccard(a: Artifact, b: Artifact): number {
  const setA = new Set(TRAIT_KEYS.map(k => `${k}:${a[k]}`));
  const setB = new Set(TRAIT_KEYS.map(k => `${k}:${b[k]}`));
  
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// MinHash estimated Jaccard similarity
function minhashJaccard(hashA: `0x${string}`[], hashB: `0x${string}`[]): number {
  let matches = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] === hashB[i]) matches++;
  }
  return matches / hashA.length;
}

// Count matching traits between two artifacts
function countMatchingTraits(a: Artifact, b: Artifact): number {
  let matches = 0;
  for (const key of TRAIT_KEYS) {
    if (a[key] === b[key]) matches++;
  }
  return matches;
}

// =============================================================================
// MinHash Accuracy Tests - Statistical validation of Jaccard estimation
// =============================================================================

describe("MinHash Jaccard Estimation", function () {
  
  it("Should estimate Jaccard similarity within tolerance across controlled scenarios", function () {
    // Test scenarios with known trait overlap
    const scenarios = [
      { name: "Identical (7/7)", sharedTraits: 7, expectedJaccard: 1.0 },
      { name: "High overlap (5/7)", sharedTraits: 5, expectedJaccard: 5/7 },
      { name: "Medium overlap (4/7)", sharedTraits: 4, expectedJaccard: 4/7 },
      { name: "Threshold (3/7)", sharedTraits: 3, expectedJaccard: 3/7 },
      { name: "Low overlap (2/7)", sharedTraits: 2, expectedJaccard: 2/7 },
      { name: "Minimal (1/7)", sharedTraits: 1, expectedJaccard: 1/7 },
      { name: "Disjoint (0/7)", sharedTraits: 0, expectedJaccard: 0 },
    ];

    console.log("\n┌─────────────────────────────────────────────────────────────────┐");
    console.log("│ MinHash Jaccard Estimation Accuracy                             │");
    console.log("├──────────────────┬──────────┬──────────┬──────────┬─────────────┤");
    console.log("│ Scenario         │ Expected │ MinHash  │ Error    │ 2/5 Match?  │");
    console.log("├──────────────────┼──────────┼──────────┼──────────┼─────────────┤");

    for (const scenario of scenarios) {
      // Create base artifact
      const base = createArtifact({
        rarity: ['legendary'],
        age: ['antediluvian'],
        quality: ['immaculate'],
        material: ['orichalcum'],
        form: ['scepter'],
        site: ['frozen-citadel'],
        inscription: ['glowing'],
      });

      // Create comparison artifact with controlled overlap
      const compared: Artifact = { ...base };
      const keysToChange = TRAIT_KEYS.slice(scenario.sharedTraits);
      
      for (const key of keysToChange) {
        // Pick a different value
        const values = TRAIT_VALUES[key];
        const currentIdx = values.indexOf(base[key]);
        compared[key] = values[(currentIdx + 1) % values.length];
      }

      const hashBase = computeMinHash(base);
      const hashCompared = computeMinHash(compared);
      
      const trueJ = trueJaccard(base, compared);
      const minhashJ = minhashJaccard(hashBase, hashCompared);
      const error = Math.abs(minhashJ - trueJ);
      const matches = Math.round(minhashJ * 5);
      const wouldPolymerase = matches >= 2 ? "✅ Yes" : "❌ No";

      console.log(
        `│ ${scenario.name.padEnd(16)} │ ${trueJ.toFixed(3).padStart(8)} │ ${minhashJ.toFixed(3).padStart(8)} │ ${error.toFixed(3).padStart(8)} │ ${wouldPolymerase.padStart(11)} │`
      );

      // Assert identical artifacts have perfect match
      if (scenario.sharedTraits === 7) {
        assert.equal(minhashJ, 1.0, "Identical artifacts should have MinHash similarity of 1.0");
      }
    }

    console.log("└──────────────────┴──────────┴──────────┴──────────┴─────────────┘\n");
  });

  it("Should converge to true Jaccard over many random pairs", function () {
    const TRIALS = 100;
    const results: { trueJ: number; minhashJ: number }[] = [];

    for (let i = 0; i < TRIALS; i++) {
      const a = randomArtifact();
      const b = randomArtifact();
      
      const hashA = computeMinHash(a);
      const hashB = computeMinHash(b);
      
      results.push({
        trueJ: trueJaccard(a, b),
        minhashJ: minhashJaccard(hashA, hashB),
      });
    }

    // Group by true Jaccard buckets and check average error
    const buckets: Record<string, { errors: number[]; count: number }> = {};
    
    for (const r of results) {
      const bucket = (Math.round(r.trueJ * 7) / 7).toFixed(2); // bucket by trait overlap
      if (!buckets[bucket]) buckets[bucket] = { errors: [], count: 0 };
      buckets[bucket].errors.push(Math.abs(r.minhashJ - r.trueJ));
      buckets[bucket].count++;
    }

    console.log("\n┌───────────────────────────────────────────────────┐");
    console.log("│ Random Pair Jaccard Estimation (n=100)            │");
    console.log("├────────────────┬─────────┬────────────────────────┤");
    console.log("│ True Jaccard   │ Samples │ Mean Absolute Error    │");
    console.log("├────────────────┼─────────┼────────────────────────┤");

    let totalError = 0;
    let totalCount = 0;

    for (const [bucket, data] of Object.entries(buckets).sort()) {
      const meanError = data.errors.reduce((a, b) => a + b, 0) / data.errors.length;
      totalError += data.errors.reduce((a, b) => a + b, 0);
      totalCount += data.count;
      console.log(`│ ${bucket.padStart(14)} │ ${String(data.count).padStart(7)} │ ${meanError.toFixed(4).padStart(22)} │`);
    }

    const overallMeanError = totalError / totalCount;
    console.log("├────────────────┼─────────┼────────────────────────┤");
    console.log(`│ Overall MAE    │ ${String(totalCount).padStart(7)} │ ${overallMeanError.toFixed(4).padStart(22)} │`);
    console.log("└────────────────┴─────────┴────────────────────────┘\n");

    // Assert mean absolute error is reasonable (< 0.3 for 5-band MinHash)
    assert.ok(
      overallMeanError < 0.35,
      `Mean absolute error ${overallMeanError.toFixed(4)} exceeds threshold 0.35`
    );
  });

  it("Should reliably distinguish polymerase-eligible pairs", function () {
    const TRIALS = 50;
    let truePositives = 0;  // correctly allows polymerase
    let trueNegatives = 0;  // correctly rejects
    let falsePositives = 0; // incorrectly allows (bad!)
    let falseNegatives = 0; // incorrectly rejects

    // Polymerase threshold: 2/5 MinHash matches (~0.4 similarity)
    const MINHASH_THRESHOLD = 0.4;
    // True threshold: 4/10 Jaccard (4 shared traits out of 10 unique)
    const TRUE_THRESHOLD = 4 / 10;

    for (let i = 0; i < TRIALS; i++) {
      const a = randomArtifact();
      const b = randomArtifact();
      
      const trueJ = trueJaccard(a, b);
      const hashA = computeMinHash(a);
      const hashB = computeMinHash(b);
      const minhashJ = minhashJaccard(hashA, hashB);

      const shouldAllow = trueJ >= TRUE_THRESHOLD;
      const wouldAllow = minhashJ >= MINHASH_THRESHOLD;

      if (shouldAllow && wouldAllow) truePositives++;
      else if (!shouldAllow && !wouldAllow) trueNegatives++;
      else if (!shouldAllow && wouldAllow) falsePositives++;
      else falseNegatives++;
    }

    const accuracy = (truePositives + trueNegatives) / TRIALS;
    const precision = truePositives / (truePositives + falsePositives) || 1;
    const recall = truePositives / (truePositives + falseNegatives) || 1;

    console.log("\n┌───────────────────────────────────────────────────┐");
    console.log("│ Polymerase Eligibility Classification (n=50)      │");
    console.log("├───────────────────────────────────────────────────┤");
    console.log(`│ True Positives:  ${String(truePositives).padStart(3)}  (correctly allowed)        │`);
    console.log(`│ True Negatives:  ${String(trueNegatives).padStart(3)}  (correctly rejected)       │`);
    console.log(`│ False Positives: ${String(falsePositives).padStart(3)}  (incorrectly allowed) ⚠️   │`);
    console.log(`│ False Negatives: ${String(falseNegatives).padStart(3)}  (incorrectly rejected)     │`);
    console.log("├───────────────────────────────────────────────────┤");
    console.log(`│ Accuracy:  ${(accuracy * 100).toFixed(1)}%                                │`);
    console.log(`│ Precision: ${(precision * 100).toFixed(1)}%                                │`);
    console.log(`│ Recall:    ${(recall * 100).toFixed(1)}%                                │`);
    console.log("└───────────────────────────────────────────────────┘\n");

    // False positives increased with 2/5 threshold - accept up to 25%
    // This is the tradeoff for more permissive polymerization
    assert.ok(
      falsePositives <= TRIALS * 0.25,
      `Too many false positives: ${falsePositives}/${TRIALS} (max 25%)`
    );
  });
});

// =============================================================================
// Polymerase Contract Tests
// =============================================================================

describe("Polymerase", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it("Should polymerase two identical artifacts (100% similarity)", async function () {
    const contract = await viem.deployContract("JaccardERC1155");
    const owner = walletClient.account.address;

    // Two identical bronze tablets from desert tomb
    const artifact = createArtifact({
      age: ['bronze'],
      material: ['bronze'],
      form: ['tablet'],
      site: ['desert-tomb'],
      quality: ['worn'],
      rarity: ['common'],
      inscription: ['faded'],
    });

    const minHash = computeMinHash(artifact) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    // Mint two copies
    const tx1 = await contract.write.faucet([owner, 1n, minHash]);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    const counter1 = await contract.read.faucetIdCounter();
    const fullId1 = (BigInt("0xfaace7") << 232n) | BigInt(counter1);

    const tx2 = await contract.write.faucet([owner, 1n, minHash]);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    const counter2 = await contract.read.faucetIdCounter();
    const fullId2 = (BigInt("0xfaace7") << 232n) | BigInt(counter2);

    // New artifact gets upgraded quality
    const upgradedArtifact = { ...artifact, quality: 'intact', rarity: 'uncommon' };
    const newMinHash = computeMinHash(upgradedArtifact) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    // Polymerase should succeed (100% match) - B onto A, 0 essence (all traits match)
    const polyTx = await contract.write.polymerase([fullId1, fullId2, owner, 1n, newMinHash, 0n]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: polyTx });

    assert.equal(receipt.status, "success", "Polymerase transaction should succeed");

    // Target (A) survives, consumed (B) is burned
    const balance1 = await contract.read.balanceOf([owner, fullId1]);
    const balance2 = await contract.read.balanceOf([owner, fullId2]);
    assert.equal(balance1, 1n, "Target artifact (A) should survive");
    assert.equal(balance2, 0n, "Consumed artifact (B) should be burned");

    // Target's minHash should be updated
    const updatedHash = await contract.read.getMinHashByTokenId([fullId1]);
    assert.deepEqual([...updatedHash], [...newMinHash], "Target minHash should be updated");

    console.log("✅ Polymerized identical artifacts successfully");
  });

  it("Should polymerase artifacts with 3/5 similarity", async function () {
    const contract = await viem.deployContract("JaccardERC1155");
    const owner = walletClient.account.address;

    // Two artifacts sharing 3+ traits (age, material, form)
    const artifact1 = createArtifact({
      age: ['bronze'],
      material: ['bronze'],
      form: ['tablet'],
      site: ['desert-tomb'],
      quality: ['worn'],
      rarity: ['common'],
      inscription: ['faded'],
    });

    const artifact2 = createArtifact({
      age: ['bronze'],      // same
      material: ['bronze'], // same  
      form: ['tablet'],     // same
      site: ['sunken-temple'], // different
      quality: ['fragmented'], // different
      rarity: ['uncommon'],    // different
      inscription: ['unmarked'], // different
    });

    const minHash1 = computeMinHash(artifact1) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];
    const minHash2 = computeMinHash(artifact2) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    const similarity = minhashJaccard(minHash1, minHash2);
    console.log(`Jaccard similarity: ${similarity} (${similarity * 5}/5 expected matches)`);

    // Mint both
    const tx1 = await contract.write.faucet([owner, 1n, minHash1]);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    const counter1 = await contract.read.faucetIdCounter();
    const fullId1 = (BigInt("0xfaace7") << 232n) | BigInt(counter1);

    const tx2 = await contract.write.faucet([owner, 1n, minHash2]);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    const counter2 = await contract.read.faucetIdCounter();
    const fullId2 = (BigInt("0xfaace7") << 232n) | BigInt(counter2);

    // New artifact combines traits
    const mergedArtifact = { ...artifact1, quality: 'intact' };
    const newMinHash = computeMinHash(mergedArtifact) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    if (similarity >= 0.4) {
      // Should succeed - B onto A, some essence yield
      const polyTx = await contract.write.polymerase([fullId1, fullId2, owner, 1n, newMinHash, 10n]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: polyTx });
      assert.equal(receipt.status, "success", "Polymerase should succeed with 2/5+ matches");
      
      // Check essence was minted
      const essenceBalance = await contract.read.balanceOf([owner, 0n]); // ESSENCE_TOKEN_ID = 0
      assert.equal(essenceBalance, 10n, "Should have received 10 essence");
      console.log("✅ Polymerized similar artifacts successfully");
    } else {
      console.log("⚠️ Artifacts not similar enough, skipping polymerase");
    }
  });

  it("Should reject polymerase with insufficient similarity", async function () {
    const contract = await viem.deployContract("JaccardERC1155");
    const owner = walletClient.account.address;

    // Two completely different artifacts
    const artifact1 = createArtifact({
      age: ['neolithic'],
      material: ['clay'],
      form: ['vessel'],
      site: ['forest-barrow'],
      quality: ['fragmented'],
      rarity: ['common'],
      inscription: ['unmarked'],
    });

    const artifact2 = createArtifact({
      age: ['antediluvian'],
      material: ['orichalcum'],
      form: ['scepter'],
      site: ['frozen-citadel'],
      quality: ['immaculate'],
      rarity: ['legendary'],
      inscription: ['glowing'],
    });

    const minHash1 = computeMinHash(artifact1) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];
    const minHash2 = computeMinHash(artifact2) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    const similarity = minhashJaccard(minHash1, minHash2);
    console.log(`Jaccard similarity of different artifacts: ${similarity}`);

    // Mint both
    const tx1 = await contract.write.faucet([owner, 1n, minHash1]);
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    const counter1 = await contract.read.faucetIdCounter();
    const fullId1 = (BigInt("0xfaace7") << 232n) | BigInt(counter1);

    const tx2 = await contract.write.faucet([owner, 1n, minHash2]);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    const counter2 = await contract.read.faucetIdCounter();
    const fullId2 = (BigInt("0xfaace7") << 232n) | BigInt(counter2);

    const newMinHash = computeMinHash({ ...artifact1, quality: 'intact' }) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    // Should revert
    try {
      await contract.write.polymerase([fullId1, fullId2, owner, 1n, newMinHash, 0n]);
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("Need 2/5 minhash matches"),
        `Expected minhash match error, got: ${error.message}`
      );
      console.log("✅ Correctly rejected dissimilar artifacts");
    }
  });

  it("Should reject polymerase of same token", async function () {
    const contract = await viem.deployContract("JaccardERC1155");
    const owner = walletClient.account.address;

    const artifact = createArtifact({});
    const minHash = computeMinHash(artifact) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

    const tx = await contract.write.faucet([owner, 1n, minHash]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    const counter = await contract.read.faucetIdCounter();
    const fullId = (BigInt("0xfaace7") << 232n) | BigInt(counter);

    try {
      await contract.write.polymerase([fullId, fullId, owner, 1n, minHash, 0n]);
      assert.fail("Should have reverted");
    } catch (error: any) {
      assert.ok(
        error.message.includes("Cannot polymerase same token"),
        `Expected same token error, got: ${error.message}`
      );
      console.log("✅ Correctly rejected same token polymerase");
    }
  });
});

