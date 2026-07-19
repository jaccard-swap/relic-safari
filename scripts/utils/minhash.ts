import { keccak256, toHex } from 'viem';
/**
 * maybe in future the idea is given a collection,
 * we find the minimum amountn of seeds required to uniquely map the collection 1 hash to 1 nft
 * however if we find that to be too much in storage costs,
 * than we tailor the number of seeds so as to balance storage costs against accuracy in jaccard similarity
 * matches JaccardERC1155Facet/JaccardSwapFacet's bytes8[20] minHash layout
 */
// Configuration for MinHash
export const MINHASH_CONFIG = {
    numHashes: 20,
    // Deterministic seeds for hash functions. Must have >= numHashes entries --
    // seeds[i] silently reading as undefined for i >= seeds.length was a real
    // bug here previously (numHashes was bumped without extending this array,
    // making every hash function past index 4 an identical, non-independent
    // duplicate instead of extra Jaccard-estimate accuracy).
    seeds: Array.from(
        { length: 20 },
        (_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}` as `0x${string}`
    )
};

/**
 * Extract features from NFT metadata in canonical format
 */
function extractFeatures(nft: any): string[] {
    const features: string[] = [];
    
    for (const [key, value] of Object.entries(nft)) {
        // Skip image URLs and descriptions
        if (key === 'image' || key === 'description') {
            continue;
        }
        
        if (Array.isArray(value)) {
            for (const item of value) {
                features.push(`${key}:${item}`);
            }
        } else if (value !== null && value !== undefined) {
            features.push(`${key}:${value}`);
        }
    }
    
    return features;
}

/**
 * Hash a feature string to bytes32 using viem's keccak256
 */
function hashFeature(feature: string): `0x${string}` {
    return keccak256(toHex(feature));
}

/**
 * Truncate a bytes32 hex string down to its low-order 8 bytes (bytes8),
 * matching the diamond contract's bytes8[20] minHash storage layout.
 */
function truncateToBytes8(hash: `0x${string}`): `0x${string}` {
    return ('0x' + hash.slice(-16)) as `0x${string}`;
}

/**
 * Compute MinHash signature for an NFT
 */
export function computeMinHash(nft: any): `0x${string}`[] {
    const features = extractFeatures(nft);
    const hashedFeatures = features.map(hashFeature);

    if (hashedFeatures.length === 0) {
        throw new Error('NFT has no features to hash');
    }

    const signature: `0x${string}`[] = [];

    for (let i = 0; i < MINHASH_CONFIG.numHashes; i++) {
        // Full bytes32 width for the running min-comparison (more entropy
        // for a fair minimum); only the winning value gets truncated below.
        let minHash = ('0x' + 'f'.repeat(64)) as `0x${string}`;

        for (const featureHash of hashedFeatures) {
            const h = keccak256(toHex(featureHash + MINHASH_CONFIG.seeds[i]));

            if (BigInt(h) < BigInt(minHash)) {
                minHash = h;
            }
        }

        signature.push(truncateToBytes8(minHash));
    }

    return signature;
}

/**
 * Generate MinHash data for NFT - returns first hash as tokenId
 */
export function generateMinHash(nft: any): `0x${string}`[20] {
    return computeMinHash(nft) as unknown as `0x${string}`[20];
}
