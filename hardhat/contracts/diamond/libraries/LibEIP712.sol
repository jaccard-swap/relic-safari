// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title LibEIP712
/// @notice Shared EIP-712 domain separator for the JaccardDiamond
/// @dev All facets use this single domain - verifyingContract is the diamond address
library LibEIP712 {
    bytes32 constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// @notice Compute the domain separator for this diamond
    /// @dev Uses address(this) which resolves to diamond address in delegatecall context
    function domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256("JaccardDiamond"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Hash typed data with EIP-712 prefix
    function hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparatorV4(), structHash));
    }
}

