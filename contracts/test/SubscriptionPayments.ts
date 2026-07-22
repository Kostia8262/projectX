import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits } from "viem";
import { network } from "hardhat";

describe("SubscriptionPayments", async function () {
  const { viem } = await network.create();
  const price = parseUnits("10", 6); // 10 units of a 6-decimal stablecoin

  async function deployFixture() {
    const [, owner, subscriber, treasury] = await viem.getWalletClients();
    const token = await viem.deployContract("MockStablecoin");

    const subscription = await viem.deployContract("SubscriptionPayments", [
      token.address,
      treasury.account.address,
      price,
      owner.account.address,
    ]);

    await token.write.mint([subscriber.account.address, price * 5n]);
    await token.write.approve([subscription.address, price * 5n], {
      account: subscriber.account,
    });

    return { token, subscription, owner, subscriber, treasury };
  }

  describe("constructor", function () {
    it("sets payment token, treasury, price and owner", async function () {
      const { subscription, token, owner, treasury } = await deployFixture();
      assert.equal(
        getAddress(await subscription.read.paymentToken()),
        getAddress(token.address)
      );
      assert.equal(
        getAddress(await subscription.read.treasury()),
        getAddress(treasury.account.address)
      );
      assert.equal(await subscription.read.subscriptionPrice(), price);
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
          price,
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
          price,
          owner.account.address,
        ])
      );
    });

    it("reverts on a zero subscription price", async function () {
      const [, owner, , treasury] = await viem.getWalletClients();
      const token = await viem.deployContract("MockStablecoin");
      await assert.rejects(
        viem.deployContract("SubscriptionPayments", [
          token.address,
          treasury.account.address,
          0n,
          owner.account.address,
        ])
      );
    });
  });

  describe("subscribe()", function () {
    it("transfers the price straight to the treasury and emits an event", async function () {
      const { subscription, token, subscriber, treasury } = await deployFixture();

      const treasuryBalanceBefore = await token.read.balanceOf([treasury.account.address]);

      await viem.assertions.emitWithArgs(
        subscription.write.subscribe({ account: subscriber.account }),
        subscription,
        "SubscriptionPaid",
        [getAddress(subscriber.account.address), price, (_: bigint) => true]
      );

      const treasuryBalanceAfter = await token.read.balanceOf([treasury.account.address]);
      assert.equal(treasuryBalanceAfter - treasuryBalanceBefore, price);
    });

    it("never leaves a balance sitting on the contract itself", async function () {
      const { subscription, token, subscriber } = await deployFixture();
      await subscription.write.subscribe({ account: subscriber.account });
      assert.equal(await token.read.balanceOf([subscription.address]), 0n);
    });

    it("reverts if the subscriber has not approved enough allowance", async function () {
      const { subscription, token, subscriber } = await deployFixture();
      // burn the approval down to zero
      await token.write.approve([subscription.address, 0n], {
        account: subscriber.account,
      });
      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe({ account: subscriber.account }),
        token,
        "ERC20InsufficientAllowance"
      );
    });

    it("reverts if the subscriber does not have enough balance", async function () {
      const { subscription, token, treasury } = await deployFixture();
      // `treasury` account has no minted balance and no approval
      await token.write.approve([subscription.address, price], {
        account: treasury.account,
      });
      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe({ account: treasury.account }),
        token,
        "ERC20InsufficientBalance"
      );
    });

    it("rolls back the whole transaction if the payment token tries to re-enter subscribe()", async function () {
      const [, owner, subscriber, treasury] = await viem.getWalletClients();
      const evilToken = await viem.deployContract(
        "ReentrantStablecoin"
      );
      const subscription = await viem.deployContract("SubscriptionPayments", [
        evilToken.address,
        treasury.account.address,
        price,
        owner.account.address,
      ]);
      await evilToken.write.setAttackTarget([subscription.address]);
      await evilToken.write.mint([subscriber.account.address, price * 5n]);
      await evilToken.write.approve([subscription.address, price * 5n], {
        account: subscriber.account,
      });

      await viem.assertions.revertWithCustomError(
        subscription.write.subscribe({ account: subscriber.account }),
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

  describe("setSubscriptionPrice()", function () {
    it("lets the owner update the price and emits an event", async function () {
      const { subscription, owner } = await deployFixture();
      const newPrice = parseUnits("20", 6);

      await viem.assertions.emitWithArgs(
        subscription.write.setSubscriptionPrice([newPrice], {
          account: owner.account,
        }),
        subscription,
        "PriceUpdated",
        [price, newPrice]
      );
      assert.equal(await subscription.read.subscriptionPrice(), newPrice);
    });

    it("reverts when called by anyone other than the owner", async function () {
      const { subscription, subscriber } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setSubscriptionPrice([parseUnits("20", 6)], {
          account: subscriber.account,
        }),
        subscription,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on a zero price", async function () {
      const { subscription, owner } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        subscription.write.setSubscriptionPrice([0n], { account: owner.account }),
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
