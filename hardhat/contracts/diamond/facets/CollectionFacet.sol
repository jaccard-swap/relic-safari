// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { IBadges } from "../interfaces/IBadges.sol";

/// @title CollectionFacet
/// @notice Freezes a completed "cupboard" (7 fully-upgraded artifacts, one
/// per Form value, sharing one Site+Age+Material combination) into a
/// permanent, soulbound Badge. Deliberately does not inherit ERC1155 or
/// ERC721 - it burns JaccardERC1155 tokens and mints Badges by writing
/// AppStorage directly instead of calling into JaccardERC1155Facet or
/// BadgesFacet, because facets are separate contracts that only share
/// storage via delegatecall, not each other's internal Solidity functions
/// (see JaccardERC1155Facet._mintEssenceERC20/_burnEssenceERC20 for the
/// established precedent this mirrors).
contract CollectionFacet is IBadges {
    /// @dev IERC1155's TransferBatch, re-declared locally so this burn can
    /// emit the standard event without inheriting ERC1155 (same reasoning
    /// as IBadges.Transfer being re-declared instead of imported from OZ).
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);

    /// @dev Not part of IBadges - this is JaccardERC1155Facet's leaderboard
    /// concept, not a badge concept, even though this function is what
    /// mutates it (same cross-facet-storage-write reasoning as everything
    /// else in this contract).
    event LeaderboardPointsAwarded(address indexed owner, uint256 points, uint256 newTotal);

    // Eligibility (which 7 tokenIds fill this exact cupboard, and that each
    // is fully-upgraded) and the points this cupboard is worth (inverse of
    // its Site+Age+Material rarity - see shared/constants getCupboardPoints)
    // are decided off-chain by the trusted API, same trust model as
    // polymerase()/upgradeTrait() on JaccardERC1155Facet - enforceIsContractOwner
    // means only that backend can ever reach this function.
    function completeCupboard(
        address owner,
        uint256[7] calldata tokenIds,
        bytes32 cupboardKey,
        uint256 points
    ) external returns (uint256 badgeId) {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(!s.cupboardCompleted[owner][cupboardKey], "Collection: cupboard already completed");

        uint256[] memory ids = new uint256[](7);
        uint256[] memory values = new uint256[](7);
        for (uint256 i = 0; i < 7; i++) {
            uint256 tokenId = tokenIds[i];
            uint256 balance = s._erc1155balances[tokenId][owner];
            require(balance >= 1, "Collection: not owner");
            unchecked {
                s._erc1155balances[tokenId][owner] = balance - 1;
            }
            ids[i] = tokenId;
            values[i] = 1;
        }
        emit TransferBatch(msg.sender, owner, address(0), ids, values);

        s.cupboardCompleted[owner][cupboardKey] = true;

        badgeId = s.nextBadgeId++;
        s.badgeOwner[badgeId] = owner;
        s.badgeLocked[badgeId] = true;
        s.badgeCupboard[badgeId] = cupboardKey;
        s.ownerBadgeCount[owner] += 1;

        emit Transfer(address(0), owner, badgeId);
        emit Locked(badgeId);

        uint256 newTotal = s.leaderboardPoints[owner] + points;
        s.leaderboardPoints[owner] = newTotal;
        emit LeaderboardPointsAwarded(owner, points, newTotal);
    }
}
