import { keccak256, toHex } from 'viem';
/**
 * maybe in future the idea is given a collection,
 * we find the minimum amountn of seeds required to uniquely map the collection 1 hash to 1 nft
 * however if we find that to be too much in storage costs,
 * than we tailor the number of seeds so as to balance storage costs against accuracy in jaccard similarity
 * basic implementation hardcodes 5 seeds and 5 hashes
 */
// Configuration for MinHash
export const MINHASH_CONFIG = {
    numHashes: 5,
    // Deterministic seeds for hash functions
    seeds: [
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000000000000000000000000000003',
        '0x0000000000000000000000000000000000000000000000000000000000000004',
        '0x0000000000000000000000000000000000000000000000000000000000000005',
    ] as const
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
        let minHash = ('0x' + 'f'.repeat(64)) as `0x${string}`;
        
        for (const featureHash of hashedFeatures) {
            const h = keccak256(toHex(featureHash + MINHASH_CONFIG.seeds[i]));
            
            if (BigInt(h) < BigInt(minHash)) {
                minHash = h;
            }
        }
        
        signature.push(minHash);
    }
    
    return signature;
}

/**
 * Generate MinHash data for NFT - returns first hash as tokenId
 */
export function generateMinHash(nft: any): `0x${string}`[5] { 
    return computeMinHash(nft) as unknown as `0x${string}`[5];
}
