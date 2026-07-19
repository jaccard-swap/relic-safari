// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { LibAppStorage, AppStorage } from "../libraries/LibAppStorage.sol";
import { LibEIP712 } from "../libraries/LibEIP712.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title EssenceFacet
/// @notice ERC20 token for Essence - extracted from polymerization
/// @dev DEX-compatible ERC20 with EIP-2612 permit
contract EssenceFacet is ERC20, IERC20Permit {

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    error ERC2612ExpiredSignature(uint256 deadline);
    error ERC2612InvalidSigner(address signer, address owner);
    error InvalidAccountNonce(address account, uint256 currentNonce);

    // ============ Constructor ============

    constructor() ERC20("", "") {}

    // ============ Initializer ============

    function initializeEssence(string memory name_, string memory symbol_) external {
        LibDiamond.enforceIsContractOwner();
        AppStorage storage s = LibAppStorage.diamondStorage();
        require(bytes(s._erc20name).length == 0, "Already initialized");
        s._erc20name = name_;
        s._erc20symbol = symbol_;
    }

    // ============ Owner Functions ============

    function mint(address to, uint256 amount) external {
        LibDiamond.enforceIsContractOwner();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        LibDiamond.enforceIsContractOwner();
        _burn(from, amount);
    }

    // ============ ERC20 View Overrides ============

    function name() public view override returns (string memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20name;
    }

    function symbol() public view override returns (string memory) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20symbol;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function totalSupply() public view override returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20balances[account];
    }

    function allowance(address owner, address spender) public view override returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20allowances[owner][spender];
    }

    // ============ ERC20 Internal Overrides ============

    function _update(address from, address to, uint256 value) internal override {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (from == address(0)) {
            // Minting
            s._erc20totalSupply += value;
        } else {
            uint256 fromBalance = s._erc20balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            unchecked {
                s._erc20balances[from] = fromBalance - value;
            }
        }

        if (to == address(0)) {
            // Burning
            unchecked {
                s._erc20totalSupply -= value;
            }
        } else {
            unchecked {
                s._erc20balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal override {
        AppStorage storage s = LibAppStorage.diamondStorage();

        if (owner == address(0)) {
            revert ERC20InvalidApprover(address(0));
        }
        if (spender == address(0)) {
            revert ERC20InvalidSpender(address(0));
        }
        s._erc20allowances[owner][spender] = value;
        if (emitEvent) {
            emit Approval(owner, spender, value);
        }
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal override {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 currentAllowance = s._erc20allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) {
                revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            }
            unchecked {
                s._erc20allowances[owner][spender] = currentAllowance - value;
            }
        }
    }

    // ============ EIP-2612 Permit ============

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        if (block.timestamp > deadline) {
            revert ERC2612ExpiredSignature(deadline);
        }

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));
        bytes32 hash = LibEIP712.hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        if (signer != owner) {
            revert ERC2612InvalidSigner(signer, owner);
        }

        _approve(owner, spender, value);
    }

    // ============ Nonces ============

    function nonces(address owner) public view override returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s._erc20nonces[owner];
    }

    function _useNonce(address owner) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        unchecked {
            return s._erc20nonces[owner]++;
        }
    }

    function _useCheckedNonce(address owner, uint256 nonce) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 current = s._erc20nonces[owner];
        if (nonce != current) {
            revert InvalidAccountNonce(owner, current);
        }
        unchecked {
            s._erc20nonces[owner] = current + 1;
        }
    }

    // ============ EIP-712 Domain ============

    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return LibEIP712.domainSeparatorV4();
    }
}
