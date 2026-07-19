// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MockERC20 is ERC20Permit {
  constructor() ERC20("MockERC20", "MOCK") ERC20Permit("MockERC20") {
    _mint(msg.sender, 1000000000000000000000000);
  }

  function faucet() external {
    _mint(msg.sender, 10000 * 10**18);
  }
}
