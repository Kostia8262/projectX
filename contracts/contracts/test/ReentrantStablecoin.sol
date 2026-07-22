// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ISubscribeOnce {
    function subscribe() external;
}

/// @notice Test-only malicious token that tries to re-enter `subscribe()` on
/// a configured target during `transferFrom`, so tests can prove
/// ReentrancyGuard actually blocks it. Never deploy this anywhere real.
contract ReentrantStablecoin is ERC20 {
    address public attackTarget;
    bool private attacked;

    constructor() ERC20("Reentrant Stablecoin", "rUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttackTarget(address target) external {
        attackTarget = target;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (attackTarget != address(0) && !attacked) {
            attacked = true;
            ISubscribeOnce(attackTarget).subscribe();
        }
        return super.transferFrom(from, to, amount);
    }
}
