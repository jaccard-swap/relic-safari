# Jaccard Swap

Bringing onchain liquidity to semi fungible markets.

Ask anyone prior to 2023 about similarity search and you'd probably get a blank stare. With AI entering daily workflows, it's become one of the most important primitives. Naturally we arrive at the question: how do we get similarity search onchain? The benefits are compelling—instead of relying on centralized exchanges to match NFT metadata exactly, we could encode a bid as "2/3 of these properties" or "NFTs similar to this one."

If you're familiar with probabilistic data structures like bloom filters, MinHash and locality-sensitive hashing won't be a far stretch. By analogy: take a heterogeneous optical prism and flash pictures through it onto low-resolution photographic paper. We won't know exactly what the data is, but we get a hazy fingerprint. These fingerprints can be stored onchain, letting anyone estimate similarity by comparing MinHashes—even without the original metadata.

By utilizing these primitives we achieve ultra-efficient Jaccard similarity search in a smart contract. Taking J(A,B) = |A ∩ B| / |A ∪ B| gives us a value between 0 and 1—where 0 means no overlap and 1 means identical sets.
 When minting an NFT, we construct a MinHash from its stringified "key:value" pairs. A buyer can place an order for similar NFTs without knowing about them, encoding their preference as a MinHash with a tolerance factor. The orderbook matches when similarity exceeds the threshold—true semi-fungible trading onchain. 


On-Chain Intent Matching through MinHash Similarity

- **🎯 Problem**: Current blockchain systems lack efficient on-chain similarity matching for intent crossing, relying on off-chain services for complex matching logic
- **💡 Solution**: Store MinHashes on-chain for intent metadata, enabling automatic similarity-based matching between parties with compatible intents
- **🚀 Innovation**: Users express intents with confidence intervals, and transactions execute automatically when Jaccard similarities of their MinHashes ≥ confidence threshold
- **⚡ Technology**: EIP-712 structured data + LSH MinHash + Jaccard similarity + confidence-based matching
- **📊 Real Example**: Alice's intent for "type:fire, holographic:true" has a MinHash sufficiently similar to Ken's offer of 20 USDC for a MinHash constructed from "type:fire, holographic:true" with 60% confidence, enabling automatic on-chain execution

**Key Benefits**: Intent expression, automatic discovery, gasless transactions, composable across protocols, O(1) similarity queries.

### The Intent Matching Challenge

Consider a scenario where multiple parties submit permits to the blockchain simultaneously, each with different but potentially compatible intents:

1. **Alice** wants to swap 100 USDC for tokens with specific attributes
2. **Bob** wants to provide liquidity for tokens matching certain criteria  
3. **Charlie** wants to execute a complex DeFi strategy involving multiple assets

Traditional approaches require:
- Manual order matching
- Off-chain coordination
- Complex state management
- High gas costs for coordination

### The Jaccard Swap Solution

Jaccard Swap enables efficient on-chain intent matching by:

- **Intent Expression**: Users submit EIP-712 structured intents with MinHash fingerprints
- **Automatic Matching**: The system finds compatible intents using Jaccard similarity
- **Atomic Execution**: Matching intents execute atomically without manual coordination
- **Confidence-Based**: Users set similarity thresholds for automatic execution

This creates a new paradigm where the blockchain becomes a coordination layer for intent matching, enabling complex multi-party interactions that were previously impossible or prohibitively expensive.

## The Core Problem: Complex Intent Matching Requires Off-Chain Coordination

### Current Limitations:
- **Manual Coordination**: Users must manually find compatible parties for complex transactions
- **Binary Matching**: Systems only support exact matches, not similarity-based matching
- **No Similarity Awareness**: Blockchains can't automatically match "similar" intents
- **Poor Discovery**: Users can't express intent for "transactions like this one"

Traditional blockchain systems treat each transaction as completely unique, but this ignores a fundamental reality: **many intents share common patterns and can be matched based on similarity**. Intent matching enables complex multi-party coordination that was previously impossible.

## Jaccard Swap Solution: On-Chain Similarity with MinHash

Jaccard Swap introduces a revolutionary approach by storing **MinHashes** on-chain for each intent, enabling automatic similarity-based matching across any domain.

### The Math Behind MinHash Similarity

**What is MinHash?**
MinHash belongs to a family of algorithms called Locality-Sensitive Hashing (LSH), designed to efficiently find similar items in large datasets.

**Step 1: Creating the Intent Fingerprint**
When a user submits an intent, we take all its attributes (e.g., `{asset: "USDC", amount: 1000, risk: "low", duration: "30d"}`) and convert them into a standardized document string. This document is then processed through LSH with 120 hash functions to produce a compact 16-byte MinHash.

**Step 2: The Matching Property**
Here's the key mathematical insight: If two parties want intents with the exact same attributes, they will generate the exact same MinHash. This is deterministic—same input always produces same output.

**Step 3: Partial Matching (The "Jaccard" Part)**
What makes this powerful is partial matching. If two intents share some (but not all) attributes:
- **7/7 attributes match** → MinHashes are identical → 100% similarity
- **5/7 attributes match** → MinHashes are similar → ~70% similarity  
- **3/7 attributes match** → MinHashes are less similar → ~40% similarity
- **0/7 attributes match** → MinHashes are different → ~0% similarity

The Jaccard similarity score (calculated by comparing matching bits in the MinHash) approximates the proportion of shared attributes between the two intents.

**Step 4: Probabilistic Attestation**
This is a probabilistic system—the MinHash is a lossy compression of the full intent metadata. However, it provides a statistically reliable estimate of similarity between two intents. The more hash functions used (we use 120), the more accurate the similarity estimate.

### Multi-Party Intent Coordination Visualization

Imagine a scenario where multiple parties submit EIP-712 permits simultaneously:

```
Block N: Intent Submissions
├── Alice: "I want to swap 100 USDC for tokens with {type: "DeFi", risk: "medium"}"
├── Bob: "I want to provide liquidity for {type: "DeFi", risk: "medium", yield: "high"}"  
├── Charlie: "I want to execute strategy with {type: "DeFi", risk: "low", duration: "long"}"
└── Diana: "I want to arbitrage {type: "DeFi", risk: "medium", yield: "high"}"

Jaccard Similarity Matrix:
        Alice  Bob   Charlie  Diana
Alice    100%   60%    40%     50%
Bob       60%  100%    30%     80%
Charlie   40%   30%   100%     20%
Diana     50%   80%    20%    100%

Matching Threshold: 60%
→ Alice ↔ Bob: 60% match → EXECUTE
→ Bob ↔ Diana: 80% match → EXECUTE
→ Charlie: No matches above threshold → WAIT
```

This creates a coordination layer where compatible intents automatically execute, while incompatible ones wait for better matches.

## Use Cases: Financial and Resource Distribution

### DeFi Intent Matching
- **Liquidity Provision**: Users express intent to provide liquidity for specific asset pairs with risk preferences
- **Yield Farming**: Automatic matching of yield-seeking intents with compatible farming opportunities
- **Arbitrage**: Matching arbitrage opportunities with capital providers based on risk/reward profiles

### Resource Distribution
- **Computational Resources**: Matching compute-intensive tasks with available processing power
- **Storage Networks**: Intent-based matching for decentralized storage needs
- **Bandwidth Trading**: Automatic coordination of network resources based on demand patterns

### Cross-Chain Coordination
- **Bridge Operations**: Matching bridge intents across different chains for optimal routing
- **Cross-Chain Swaps**: Intent-based matching for complex multi-chain transactions
- **Governance Coordination**: Matching governance intents across different protocols

### Real-World Example: Automated Market Making
```
Alice's Intent: "Provide liquidity for {pair: "ETH/USDC", amount: 10000, risk: "medium", duration: "7d"}"
Bob's Intent: "Trade {pair: "ETH/USDC", amount: 5000, direction: "buy", slippage: "0.5%"}"
Charlie's Intent: "Arbitrage {pair: "ETH/USDC", amount: 2000, profit_threshold: "0.1%"}"
Diana's Intent: "Liquidity {pair: "ETH/USDC", amount: 15000, risk: "low", duration: "30d"}"

Jaccard Similarity Analysis:
- Alice ↔ Bob: 75% match (same pair, compatible amounts) → EXECUTE
- Alice ↔ Diana: 85% match (same pair, complementary risk profiles) → EXECUTE  
- Bob ↔ Charlie: 60% match (same pair, different strategies) → EXECUTE
- Charlie ↔ Diana: 40% match (different risk profiles) → WAIT

Result: Three successful matches execute atomically, creating a more efficient market
```

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](nodejs.org/api/test.html), the new Node.js native test runner, and [`viem`](https://viem.sh/).
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```
