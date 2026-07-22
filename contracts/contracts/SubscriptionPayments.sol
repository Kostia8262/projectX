// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal subscription payment rail. Forwards a fixed price
/// straight from the subscriber to the treasury (a Gnosis Safe multisig)
/// on every call — the contract never holds a balance, so there is nothing
/// for a bug or a compromised key to drain. Subscription status is not
/// tracked here; it is derived off-chain from the `SubscriptionPaid` events.
contract SubscriptionPayments is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The stablecoin subscribers pay in (USDT or USDC).
    IERC20 public immutable paymentToken;

    /// @notice Where every payment is forwarded to. Intended to be a
    /// Gnosis Safe multisig, not a single EOA.
    address public treasury;

    /// @notice Price of one subscription period, in the payment token's
    /// smallest unit.
    uint256 public subscriptionPrice;

    event SubscriptionPaid(address indexed subscriber, uint256 amount, uint256 timestamp);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event PriceUpdated(uint256 previousPrice, uint256 newPrice);

    error ZeroAddress();
    error ZeroPrice();

    constructor(
        address _paymentToken,
        address _treasury,
        uint256 _subscriptionPrice,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_paymentToken == address(0) || _treasury == address(0)) revert ZeroAddress();
        if (_subscriptionPrice == 0) revert ZeroPrice();
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        subscriptionPrice = _subscriptionPrice;
    }

    /// @notice Pay for one subscription period. Requires the caller to have
    /// approved this contract for at least `subscriptionPrice` beforehand.
    function subscribe() external nonReentrant {
        uint256 price = subscriptionPrice;
        paymentToken.safeTransferFrom(msg.sender, treasury, price);
        emit SubscriptionPaid(msg.sender, price, block.timestamp);
    }

    /// @notice Update the treasury address. Owner-gated (owner should be the
    /// Gnosis Safe multisig itself, not a single EOA).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Update the subscription price. Owner-gated.
    function setSubscriptionPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        emit PriceUpdated(subscriptionPrice, newPrice);
        subscriptionPrice = newPrice;
    }
}
