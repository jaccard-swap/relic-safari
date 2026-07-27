// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { IBadges } from "../interfaces/IBadges.sol";

/// @title BadgesFacet
/// @notice Read-only view surface for Collection badges, implementing
/// EIP-5192's actual required interface (locked()) plus a small custom read
/// API. Never mints or burns anything itself - CollectionFacet writes badge
/// state directly into the same AppStorage this facet reads from (see its
/// header comment for why).
/// @dev Deliberately NOT a full ERC721 selector surface, and deliberately
/// has no transfer or approval functions of any kind - not even ones that
/// revert. Two reasons:
///   1. This diamond already hosts EssenceFacet (ERC20) and
///      JaccardERC1155Facet (ERC1155) at the same address. ERC721's
///      balanceOf(address), transferFrom(address,address,uint256),
///      approve(address,uint256), setApprovalForAll(address,bool) and
///      isApprovedForAll(address,address) all share exact selectors with
///      functions those facets already register - a diamond cut adding any
///      of them would fail outright ("Can't add function that already
///      exists"), and had one somehow landed on a different facet by
///      accident, a generic ERC721 client calling e.g. approve() on this
///      address would silently hit Essence's ERC20 approve instead.
///   2. Soulbound is strongest when the capability plainly doesn't exist,
///      not when it exists and reverts - there is no code path anywhere
///      that can ever move a badge out of its owner's address.
/// balanceOf/ownerOf below are therefore renamed/kept only where their
/// selector is actually free; supportsInterface isn't implemented here at
/// all (ERC721/IERC5192 support is instead registered globally via
/// DiamondInit.init()'s ds.supportedInterfaces, the same workaround
/// JaccardERC1155Facet's own supportsInterface already needed).
contract BadgesFacet is IBadges {
    /// @notice How many badges `owner` holds. Named badgeCount, not
    /// balanceOf(address) - that selector is already EssenceFacet's ERC20
    /// balanceOf.
    function badgeCount(address owner) external view returns (uint256) {
        require(owner != address(0), "Badges: zero address");
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.ownerBadgeCount[owner];
    }

    /// @notice ERC721-shaped - free selector, no collision on this diamond.
    function ownerOf(uint256 tokenId) public view returns (address owner) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        owner = s.badgeOwner[tokenId];
        require(owner != address(0), "Badges: nonexistent badge");
    }

    /// @notice EIP-5192's one required function. Every badge is
    /// permanently locked - there is no unlock path.
    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId); // reverts if the badge doesn't exist
        return true;
    }

    /// @notice Which Site+Age+Material cupboard this badge represents -
    /// matches the cupboardKey computed off-chain (shared/constants'
    /// getCupboardKey) and passed to CollectionFacet.completeCupboard.
    function cupboardOf(uint256 tokenId) external view returns (bytes32) {
        ownerOf(tokenId); // reverts if the badge doesn't exist
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.badgeCupboard[tokenId];
    }

    /// @dev Stubbed - badge image/metadata generation is follow-up work.
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId); // reverts if the badge doesn't exist
        return "";
    }
}
