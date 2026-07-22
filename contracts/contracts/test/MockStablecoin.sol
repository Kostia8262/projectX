// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only stand-in for USDT/USDC (6 decimals, open mint) — real
/// USDT/USDC don't exist on local/test networks, so tests and testnet
/// deployments use this instead. Never deploy this to mainnet.
contract MockStablecoin is ERC20 {
    constructor() ERC20("Mock Stablecoin", "mUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
