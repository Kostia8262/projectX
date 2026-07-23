// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Multi-tier subscription payment rail. Forwards a tier's fixed
/// price straight from the subscriber to the treasury (a Gnosis Safe
/// multisig) on every call — the contract never holds a balance, so there is
/// nothing for a bug or a compromised key to drain. Subscription status
/// (including which tier is active) is not tracked here; it is derived
/// off-chain from `SubscriptionPaid` events, same as the single-price
/// version this replaces.
///
/// Tier IDs are opaque uint8s the owner assigns prices to — the app's
/// `lib/subscription/tiers.ts` is the source of truth for what each id
/// means (name, benefits, off-chain display price). Tier id 0 is reserved
/// for the free tier, which never touches this contract.
contract SubscriptionPayments is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The stablecoin subscribers pay in (USDT or USDC).
    IERC20 public immutable paymentToken;

    /// @notice Where every payment is forwarded to. Intended to be a
    /// Gnosis Safe multisig, not a single EOA.
    address public treasury;

    /// @notice Price of one subscription period for a given tier, in the
    /// payment token's smallest unit. A price of 0 means the tier is not
    /// configured (and `subscribe` rejects it).
    mapping(uint8 => uint256) public tierPrices;

    event SubscriptionPaid(
        address indexed subscriber,
        uint8 indexed tierId,
        uint256 amount,
        uint256 timestamp
    );
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event TierPriceUpdated(uint8 indexed tierId, uint256 previousPrice, uint256 newPrice);

    error ZeroAddress();
    error ZeroPrice();
    error UnknownTier();

    constructor(address _paymentToken, address _treasury, address initialOwner) Ownable(initialOwner) {
        if (_paymentToken == address(0) || _treasury == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
    }

    /// @notice Pay for one subscription period of `tierId`. Requires the
    /// caller to have approved this contract for at least that tier's price
    /// beforehand. Reverts if the tier has no price configured.
    function subscribe(uint8 tierId) external nonReentrant {
        uint256 price = tierPrices[tierId];
        if (price == 0) revert UnknownTier();
        paymentToken.safeTransferFrom(msg.sender, treasury, price);
        emit SubscriptionPaid(msg.sender, tierId, price, block.timestamp);
    }

    /// @notice Update the treasury address. Owner-gated (owner should be the
    /// Gnosis Safe multisig itself, not a single EOA).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Set (or update) the price of a tier. Owner-gated.
    function setTierPrice(uint8 tierId, uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        emit TierPriceUpdated(tierId, tierPrices[tierId], newPrice);
        tierPrices[tierId] = newPrice;
    }
}
