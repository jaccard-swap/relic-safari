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
    // Local hardhat only - this is the deployer's only fast source of Scrip
    // to seed the Scrip/Essence Uniswap pool with (see
    // scripts/create-uniswap-pool.ts) for local dev/testing, since the
    // faucet's per-account cap and 12h cooldown make reaching a meaningful
    // seed amount that way impractical. Sepolia and any real deploy skip
    // this: no free premine for the deployer there. create-uniswap-pool.ts
    // already degrades safely in that case - its own scripBalance <
    // SEED_SCRIP check skips seeding (and, since it's gated behind that
    // same check, skips the Essence owner-mint too) rather than failing, so
    // non-hardhat chains just need actual liquidity provided some other way
    // before that script can seed a pool.
    if (block.chainid == HARDHAT_CHAIN_ID) {
      _mint(msg.sender, 1000000000000000000000000);
    }
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
