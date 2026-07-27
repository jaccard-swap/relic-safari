// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";
import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { IERC173 } from "../interfaces/IERC173.sol";
import { IERC165 } from "../interfaces/IERC165.sol";

/// @title DiamondInit
/// @notice Initializer for JaccardSwap Diamond
contract DiamondInit {
    function init(string calldata uri_, string calldata erc20Name_, string calldata erc20Symbol_) external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // Register ERC165 interfaces
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
        
        // ERC1155 interface
        ds.supportedInterfaces[0xd9b67a26] = true; // IERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // IERC1155MetadataURI
        
        // ERC20 interface
        ds.supportedInterfaces[0x36372b07] = true; // IERC20

        // Badges (BadgesFacet) - ERC721 + EIP-5192 soulbound
        ds.supportedInterfaces[0x80ac58cd] = true; // IERC721
        ds.supportedInterfaces[0xb45a3c0e] = true; // IERC5192

        // Initialize AppStorage
        AppStorage storage s = LibAppStorage.diamondStorage();
        s._uri = uri_;
        s._erc20name = erc20Name_;
        s._erc20symbol = erc20Symbol_;
    }
}

