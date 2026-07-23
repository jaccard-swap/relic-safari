// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Scrip is ERC20Permit {
  constructor() ERC20("Scrip", "SCRIP") ERC20Permit("Scrip") {
    _mint(msg.sender, 1000000000000000000000000);
  }

  function faucet() external {
    _mint(msg.sender, 5 * 10**18);
  }
}
