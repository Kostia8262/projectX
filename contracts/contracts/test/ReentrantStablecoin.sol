// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ISubscribeOnce {
    function subscribe(uint8 tierId) external;
}

interface ITopUpOnce {
    function topUp(uint8 packageId) external;
}

/// @notice Test-only malicious token that tries to re-enter `subscribe()` or
/// `topUp()` (depending on which reentry mode was armed) on a configured
/// target during `transferFrom`, so tests can prove ReentrancyGuard
/// actually blocks it. Never deploy this anywhere real.
contract ReentrantStablecoin is ERC20 {
    address public attackTarget;
    // 0 = disabled. Exactly one of these should be set by the test before
    // triggering the attack.
    uint8 public subscribeReentryTier;
    uint8 public topUpReentryPackage;
    bool private subscribeReentryArmed;
    bool private topUpReentryArmed;
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

    function setSubscribeReentryTier(uint8 tierId) external {
        subscribeReentryTier = tierId;
        subscribeReentryArmed = true;
        topUpReentryArmed = false;
    }

    function setTopUpReentryPackage(uint8 packageId) external {
        topUpReentryPackage = packageId;
        topUpReentryArmed = true;
        subscribeReentryArmed = false;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (attackTarget != address(0) && !attacked) {
            attacked = true;
            if (topUpReentryArmed) {
                ITopUpOnce(attackTarget).topUp(topUpReentryPackage);
            } else if (subscribeReentryArmed) {
                ISubscribeOnce(attackTarget).subscribe(subscribeReentryTier);
            }
        }
        return super.transferFrom(from, to, amount);
    }
}
