import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits } from "viem";
import { network } from "hardhat";

describe("SubscriptionPayments", async function () {
  const { viem } = await network.create();
  const ADVANCED_TIER = 1;
  const PREMIUM_TIER = 2;
  const COLLECTOR_TIER = 3;
  const advancedPrice = parseUnits("6", 6);
  const premiumPrice = parseUnits("10", 6);

  async function deployFixture() {
    const [, owner, subscriber, treasury] = await viem.getWalletClients();
    const token = await viem.deployContract("MockStablecoin");

    const subscription = await viem.deployContract("SubscriptionPayments", [
      token.address,
      treasury.account.address,
      owner.account.address,
    ]);
    await subscription.write.setTierPrice([ADVANCED_TIER, advancedPrice], {
      account: owner.account,
    });
    await subscription.write.setTierPrice([PREMIUM_TIER, premiumPrice], {
      account: owner.account,
    });

    await token.write.mint([subscriber.account.address, premiumPrice * 5n]);
    await token.write.approve([subscription.address, premiumPrice * 5n], {
      account: subscriber.account,
    });

    return { token, subscription, owner, subscriber, treasury };
  }

  describe("constructor", function () {
    it("sets payment token, treasury and owner", async function () {
      const { subscription, token, owner, treasury } = await deployFixture();
      assert.equal(
        getAddress(await subscription.read.paymentToken()),
        getAddress(token.address)
      );
      assert.equal(
        getAddress(await subscription.read.treasury()),
        getAddress(treasury.account.address)
      );
      assert.equal(
        getAddress(await subscription.read.owner()),
        getAddress(owner.account.address)
      );
    });

    it("reverts on a zero payment token address", async function () {
      const [, owner, , treasury] = await viem.getWalletClients();
      await assert.rejects(
        viem.deployContract("SubscriptionPayments", [
          "0x0000000000000000000000000000000000000000",
          treasury.account.address,
          owner.account.address,
        ])
      );
    });

    it("reverts on a zero treasury address", async function () {
      const [, owner] = await viem.getWalletClients();
      const token = await viem.deployContract("MockStablecoin");
      await assert.rejects(
        viem.deployContract("SubscriptionPayments", [
          token.address,
          "0x0000000000000000000000000000000000000000",
          owner.account.address,
        ])
      );
    });
  });

  describe("subscribe()", function () {
    it("transfers the tier's price straight to the treasury and emits an event with the tier id", async function () {
      const { subscription, token, subscriber, treasury } = await deployFixture();

      const treasuryBalanceBefore = await token.read.balanceOf([treasury.account.address]);

      await viem.assertions.emitWithArgs(
        subscription.write.subscribe([ADVANCED_TIER], { account: subscriber.account }),
        subscription,
        "SubscriptionPaid",
        [getAddress(subscriber.account.address), ADVANCED_TIER, advancedPrice, (_: bigint) => true]
      );

      const treasuryBalanceAfter = await token.read.balanceOf([treasury.account.address]);
      assert.equal(treasuryBalanceAfter - treasuryBalanceBefore, advancedPrice);
    });

    it("charges different tiers different prices", async function () {
      const { subscription, token, subscriber, treasury } = await deployFixture();

      await subscription.write.subscribe([PREMIUM_TIER], { account: subscriber.account });
      const treasuryBalance = await token.read.balanceOf([treasury.account.address]);
      assert.equal(treasuryBalance, premiumPrice);
    });

    it("never leaves a balance sitting on the contract itself", async function () {
      const { subscription, token, subscriber } = await deployFixture();
      await subscription.write.subscribe([ADVANCED_TIER], { account: subscriber.account });
      assert.equal(await token.read.balanceOf([subscription.address]), 0n);
    });

    it("reverts on an unconfigured tier", async function () {
      const { subscription, subscriber } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe([COLLECTOR_TIER], { account: subscriber.account }),
        subscription,
        "UnknownTier"
      );
    });

    it("reverts if the subscriber has not approved enough allowance", async function () {
      const { subscription, token, subscriber } = await deployFixture();
      await token.write.approve([subscription.address, 0n], {
        account: subscriber.account,
      });
      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe([ADVANCED_TIER], { account: subscriber.account }),
        token,
        "ERC20InsufficientAllowance"
      );
    });

    it("reverts if the subscriber does not have enough balance", async function () {
      const { subscription, token, treasury } = await deployFixture();
      // `treasury` account has no minted balance and no approval
      await token.write.approve([subscription.address, advancedPrice], {
        account: treasury.account,
      });
      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe([ADVANCED_TIER], { account: treasury.account }),
        token,
        "ERC20InsufficientBalance"
      );
    });

    it("rolls back the whole transaction if the payment token tries to re-enter subscribe()", async function () {
      const [, owner, subscriber, treasury] = await viem.getWalletClients();
      const evilToken = await viem.deployContract("ReentrantStablecoin");
      const subscription = await viem.deployContract("SubscriptionPayments", [
        evilToken.address,
        treasury.account.address,
        owner.account.address,
      ]);
      await subscription.write.setTierPrice([ADVANCED_TIER, advancedPrice], {
        account: owner.account,
      });
      await evilToken.write.setAttackTarget([subscription.address]);
      await evilToken.write.setSubscribeReentryTier([ADVANCED_TIER]);
      await evilToken.write.mint([subscriber.account.address, advancedPrice * 5n]);
      await evilToken.write.approve([subscription.address, advancedPrice * 5n], {
        account: subscriber.account,
      });

      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe([ADVANCED_TIER], { account: subscriber.account }),
        subscription,
        "ReentrancyGuardReentrantCall"
      );

      // confirm nothing moved and nothing was emitted despite the attempted reentrancy
      assert.equal(await evilToken.read.balanceOf([treasury.account.address]), 0n);
    });
  });

  describe("setTreasury()", function () {
    it("lets the owner update the treasury and emits an event", async function () {
      const { subscription, owner, treasury } = await deployFixture();
      const [, , , , newTreasury] = await viem.getWalletClients();

      await viem.assertions.emitWithArgs(
        subscription.write.setTreasury([newTreasury.account.address], {
          account: owner.account,
        }),
        subscription,
        "TreasuryUpdated",
        [getAddress(treasury.account.address), getAddress(newTreasury.account.address)]
      );
      assert.equal(
        getAddress(await subscription.read.treasury()),
        getAddress(newTreasury.account.address)
      );
    });

    it("reverts when called by anyone other than the owner", async function () {
      const { subscription, subscriber } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setTreasury([subscriber.account.address], {
          account: subscriber.account,
        }),
        subscription,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on a zero address", async function () {
      const { subscription, owner } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setTreasury(
          ["0x0000000000000000000000000000000000000000"],
          { account: owner.account }
        ),
        subscription,
        "ZeroAddress"
      );
    });
  });

  describe("setTierPrice()", function () {
    it("lets the owner set a new tier's price and emits an event", async function () {
      const { subscription, owner } = await deployFixture();
      const newPrice = parseUnits("20", 6);

      await viem.assertions.emitWithArgs(
        subscription.write.setTierPrice([COLLECTOR_TIER, newPrice], {
          account: owner.account,
        }),
        subscription,
        "TierPriceUpdated",
        [COLLECTOR_TIER, 0n, newPrice]
      );
      assert.equal(await subscription.read.tierPrices([COLLECTOR_TIER]), newPrice);
    });

    it("lets the owner update an existing tier's price", async function () {
      const { subscription, owner } = await deployFixture();
      const newPrice = parseUnits("8", 6);

      await viem.assertions.emitWithArgs(
        subscription.write.setTierPrice([ADVANCED_TIER, newPrice], {
          account: owner.account,
        }),
        subscription,
        "TierPriceUpdated",
        [ADVANCED_TIER, advancedPrice, newPrice]
      );
      assert.equal(await subscription.read.tierPrices([ADVANCED_TIER]), newPrice);
    });

    it("reverts when called by anyone other than the owner", async function () {
      const { subscription, subscriber } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setTierPrice([ADVANCED_TIER, parseUnits("20", 6)], {
          account: subscriber.account,
        }),
        subscription,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on a zero price", async function () {
      const { subscription, owner } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setTierPrice([ADVANCED_TIER, 0n], { account: owner.account }),
        subscription,
        "ZeroPrice"
      );
    });
  });

  describe("ownership transfer (Ownable2Step)", function () {
    it("requires the new owner to accept before ownership actually changes", async function () {
      const { subscription, owner } = await deployFixture();
      const [, , , , candidate] = await viem.getWalletClients();

      await subscription.write.transferOwnership([candidate.account.address], {
        account: owner.account,
      });
      // ownership must NOT have changed yet — only a pending owner was set
      assert.equal(
        getAddress(await subscription.read.owner()),
        getAddress(owner.account.address)
      );

      await subscription.write.acceptOwnership({ account: candidate.account });
      assert.equal(
        getAddress(await subscription.read.owner()),
        getAddress(candidate.account.address)
      );
    });
  });
});
