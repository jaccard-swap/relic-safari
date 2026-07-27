// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Scrip is ERC20Permit {
  uint256 public constant FAUCET_COOLDOWN = 12 hours;
  // Local hardhat network's chain id - cooldown is skipped here so devs and
  // tests can claim repeatedly without waiting.
  uint256 private constant HARDHAT_CHAIN_ID = 31337;

  mapping(address => uint256) public lastFaucetClaim;

  error FaucetCooldown(uint256 availableAt);

  constructor() ERC20("Scrip", "SCRIP") ERC20Permit("Scrip") {
    // Unconditional on every chain (including real deploys) - this is the
    // deployer's only fast source of Scrip to seed the Scrip/Essence
    // Uniswap pool with (see scripts/create-uniswap-pool.ts), since the
    // faucet's per-account cap and 12h cooldown make reaching a meaningful
    // seed amount that way impractical.
    _mint(msg.sender, 1000000000000000000000000);
  }

  function faucet() external {
    if (block.chainid != HARDHAT_CHAIN_ID) {
      uint256 availableAt = lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN;
      if (block.timestamp < availableAt) revert FaucetCooldown(availableAt);
      lastFaucetClaim[msg.sender] = block.timestamp;
    }
    _mint(msg.sender, 5236067977499789696);
  }
}
