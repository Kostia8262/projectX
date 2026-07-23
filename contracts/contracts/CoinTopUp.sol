// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Shop-currency top-up rail, sold as discrete packages (not an
/// arbitrary amount) — same shape as SubscriptionPayments.sol's tiers, and
/// for the same reason: how many coins a package grants (including any bulk
/// discount) is an off-chain decision (see app/src/lib/shop/coinConfig.ts),
/// keyed by `packageId`. Packages instead of a free-form amount also close
/// off a gaming vector: if bonus coins were computed from the raw token
/// amount, a buyer could pick an arbitrary amount to try to claim a bigger
/// package's bonus rate without actually buying that package.
contract CoinTopUp is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The stablecoin players pay in (USDT or USDC).
    IERC20 public immutable paymentToken;

    /// @notice Where every top-up is forwarded to. Intended to be a Gnosis
    /// Safe multisig, not a single EOA.
    address public treasury;

    /// @notice Price of a given package id, in the payment token's smallest
    /// unit. A price of 0 means the package is not configured.
    mapping(uint8 => uint256) public packagePrices;

    event CoinsPurchased(address indexed buyer, uint8 indexed packageId, uint256 amount, uint256 timestamp);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event PackagePriceUpdated(uint8 indexed packageId, uint256 previousPrice, uint256 newPrice);

    error ZeroAddress();
    error ZeroPrice();
    error UnknownPackage();

    constructor(address _paymentToken, address _treasury, address initialOwner) Ownable(initialOwner) {
        if (_paymentToken == address(0) || _treasury == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
    }

    /// @notice Buy `packageId` — pays that package's configured price to top
    /// up in-app shop coins. Requires the caller to have approved this
    /// contract for at least that price beforehand. Reverts if the package
    /// has no price configured.
    function topUp(uint8 packageId) external nonReentrant {
        uint256 price = packagePrices[packageId];
        if (price == 0) revert UnknownPackage();
        paymentToken.safeTransferFrom(msg.sender, treasury, price);
        emit CoinsPurchased(msg.sender, packageId, price, block.timestamp);
    }

    /// @notice Update the treasury address. Owner-gated (owner should be the
    /// Gnosis Safe multisig itself, not a single EOA).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Set (or update) the price of a package. Owner-gated.
    function setPackagePrice(uint8 packageId, uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        emit PackagePriceUpdated(packageId, packagePrices[packageId], newPrice);
        packagePrices[packageId] = newPrice;
    }
}
