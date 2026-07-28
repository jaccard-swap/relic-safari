// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IBadges
/// @notice Event declarations shared between CollectionFacet (which mints
/// badges by writing AppStorage directly - a separate facet can't call into
/// another facet's internal mint logic, same reasoning as
/// JaccardERC1155Facet's _mintEssenceERC20) and BadgesFacet (which exposes
/// the read-only view surface over that same storage). Declaring events
/// once here, imported by both, keeps their signatures - and therefore
/// their log topic hashes - in exactly one place.
///
/// No Approval/ApprovalForAll events: badges have no transfer or approval
/// surface at all (see BadgesFacet's header comment for why), so nothing
/// would ever emit them.
interface IBadges {
    // ERC721-shaped (shares its topic0 hash with Essence's ERC20 Transfer -
    // that's normal for multi-standard diamonds; indexers distinguish by
    // topics.length, ERC721's tokenId is indexed, ERC20's value is not).
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    // EIP-5192: https://eips.ethereum.org/EIPS/eip-5192
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
}
