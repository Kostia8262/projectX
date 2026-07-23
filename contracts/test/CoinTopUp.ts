import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, parseUnits } from "viem";
import { network } from "hardhat";

describe("CoinTopUp", async function () {
  const { viem } = await network.create();
  const SMALL_PACKAGE = 0;
  const MEDIUM_PACKAGE = 1;
  const LARGE_PACKAGE = 2;
  const smallPrice = parseUnits("3", 6);
  const mediumPrice = parseUnits("7.5", 6);

  async function deployFixture() {
    const [, owner, buyer, treasury] = await viem.getWalletClients();
    const token = await viem.deployContract("MockStablecoin");

    const coinTopUp = await viem.deployContract("CoinTopUp", [
      token.address,
      treasury.account.address,
      owner.account.address,
    ]);
    await coinTopUp.write.setPackagePrice([SMALL_PACKAGE, smallPrice], {
      account: owner.account,
    });
    await coinTopUp.write.setPackagePrice([MEDIUM_PACKAGE, mediumPrice], {
      account: owner.account,
    });

    await token.write.mint([buyer.account.address, mediumPrice * 5n]);
    await token.write.approve([coinTopUp.address, mediumPrice * 5n], {
      account: buyer.account,
    });

    return { token, coinTopUp, owner, buyer, treasury };
  }

  describe("constructor", function () {
    it("sets payment token, treasury and owner", async function () {
      const { coinTopUp, token, owner, treasury } = await deployFixture();
      assert.equal(getAddress(await coinTopUp.read.paymentToken()), getAddress(token.address));
      assert.equal(
        getAddress(await coinTopUp.read.treasury()),
        getAddress(treasury.account.address)
      );
      assert.equal(getAddress(await coinTopUp.read.owner()), getAddress(owner.account.address));
    });

    it("reverts on a zero payment token address", async function () {
      const [, owner, , treasury] = await viem.getWalletClients();
      await assert.rejects(
        viem.deployContract("CoinTopUp", [
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
        viem.deployContract("CoinTopUp", [
          token.address,
          "0x0000000000000000000000000000000000000000",
          owner.account.address,
        ])
      );
    });
  });

  describe("topUp()", function () {
    it("transfers the package's price straight to the treasury and emits an event with the package id", async function () {
      const { coinTopUp, token, buyer, treasury } = await deployFixture();

      const treasuryBalanceBefore = await token.read.balanceOf([treasury.account.address]);

      await viem.assertions.emitWithArgs(
        coinTopUp.write.topUp([SMALL_PACKAGE], { account: buyer.account }),
        coinTopUp,
        "CoinsPurchased",
        [getAddress(buyer.account.address), SMALL_PACKAGE, smallPrice, (_: bigint) => true]
      );

      const treasuryBalanceAfter = await token.read.balanceOf([treasury.account.address]);
      assert.equal(treasuryBalanceAfter - treasuryBalanceBefore, smallPrice);
    });

    it("charges different packages different prices", async function () {
      const { coinTopUp, token, buyer, treasury } = await deployFixture();

      await coinTopUp.write.topUp([MEDIUM_PACKAGE], { account: buyer.account });
      const treasuryBalance = await token.read.balanceOf([treasury.account.address]);
      assert.equal(treasuryBalance, mediumPrice);
    });

    it("never leaves a balance sitting on the contract itself", async function () {
      const { coinTopUp, token, buyer } = await deployFixture();
      await coinTopUp.write.topUp([SMALL_PACKAGE], { account: buyer.account });
      assert.equal(await token.read.balanceOf([coinTopUp.address]), 0n);
    });

    it("reverts on an unconfigured package", async function () {
      const { coinTopUp, buyer } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.topUp([LARGE_PACKAGE], { account: buyer.account }),
        coinTopUp,
        "UnknownPackage"
      );
    });

    it("reverts if the buyer has not approved enough allowance", async function () {
      const { coinTopUp, token, buyer } = await deployFixture();
      await token.write.approve([coinTopUp.address, 0n], { account: buyer.account });
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.topUp([SMALL_PACKAGE], { account: buyer.account }),
        token,
        "ERC20InsufficientAllowance"
      );
    });

    it("reverts if the buyer does not have enough balance", async function () {
      const { coinTopUp, token, treasury } = await deployFixture();
      // `treasury` account has no minted balance and no approval
      await token.write.approve([coinTopUp.address, smallPrice], { account: treasury.account });
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.topUp([SMALL_PACKAGE], { account: treasury.account }),
        token,
        "ERC20InsufficientBalance"
      );
    });

    it("rolls back the whole transaction if the payment token tries to re-enter topUp()", async function () {
      const [, owner, buyer, treasury] = await viem.getWalletClients();
      const evilToken = await viem.deployContract("ReentrantStablecoin");
      const coinTopUp = await viem.deployContract("CoinTopUp", [
        evilToken.address,
        treasury.account.address,
        owner.account.address,
      ]);
      await coinTopUp.write.setPackagePrice([SMALL_PACKAGE, smallPrice], {
        account: owner.account,
      });
      await evilToken.write.setAttackTarget([coinTopUp.address]);
      await evilToken.write.setTopUpReentryPackage([SMALL_PACKAGE]);
      await evilToken.write.mint([buyer.account.address, smallPrice * 5n]);
      await evilToken.write.approve([coinTopUp.address, smallPrice * 5n], {
        account: buyer.account,
      });

      await viem.assertions.revertWithCustomError(
        coinTopUp.write.topUp([SMALL_PACKAGE], { account: buyer.account }),
        coinTopUp,
        "ReentrancyGuardReentrantCall"
      );

      assert.equal(await evilToken.read.balanceOf([treasury.account.address]), 0n);
    });
  });

  describe("setTreasury()", function () {
    it("lets the owner update the treasury and emits an event", async function () {
      const { coinTopUp, owner, treasury } = await deployFixture();
      const [, , , , newTreasury] = await viem.getWalletClients();

      await viem.assertions.emitWithArgs(
        coinTopUp.write.setTreasury([newTreasury.account.address], { account: owner.account }),
        coinTopUp,
        "TreasuryUpdated",
        [getAddress(treasury.account.address), getAddress(newTreasury.account.address)]
      );
      assert.equal(
        getAddress(await coinTopUp.read.treasury()),
        getAddress(newTreasury.account.address)
      );
    });

    it("reverts when called by anyone other than the owner", async function () {
      const { coinTopUp, buyer } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.setTreasury([buyer.account.address], { account: buyer.account }),
        coinTopUp,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on a zero address", async function () {
      const { coinTopUp, owner } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.setTreasury(["0x0000000000000000000000000000000000000000"], {
          account: owner.account,
        }),
        coinTopUp,
        "ZeroAddress"
      );
    });
  });

  describe("setPackagePrice()", function () {
    it("lets the owner set a new package's price and emits an event", async function () {
      const { coinTopUp, owner } = await deployFixture();
      const newPrice = parseUnits("15", 6);

      await viem.assertions.emitWithArgs(
        coinTopUp.write.setPackagePrice([LARGE_PACKAGE, newPrice], { account: owner.account }),
        coinTopUp,
        "PackagePriceUpdated",
        [LARGE_PACKAGE, 0n, newPrice]
      );
      assert.equal(await coinTopUp.read.packagePrices([LARGE_PACKAGE]), newPrice);
    });

    it("reverts when called by anyone other than the owner", async function () {
      const { coinTopUp, buyer } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.setPackagePrice([SMALL_PACKAGE, parseUnits("5", 6)], {
          account: buyer.account,
        }),
        coinTopUp,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts on a zero price", async function () {
      const { coinTopUp, owner } = await deployFixture();
      await viem.assertions.revertWithCustomError(
        coinTopUp.write.setPackagePrice([SMALL_PACKAGE, 0n], { account: owner.account }),
        coinTopUp,
        "ZeroPrice"
      );
    });
  });

  describe("ownership transfer (Ownable2Step)", function () {
    it("requires the new owner to accept before ownership actually changes", async function () {
      const { coinTopUp, owner } = await deployFixture();
      const [, , , , candidate] = await viem.getWalletClients();

      await coinTopUp.write.transferOwnership([candidate.account.address], {
        account: owner.account,
      });
      assert.equal(getAddress(await coinTopUp.read.owner()), getAddress(owner.account.address));

      await coinTopUp.write.acceptOwnership({ account: candidate.account });
      assert.equal(
        getAddress(await coinTopUp.read.owner()),
        getAddress(candidate.account.address)
      );
    });
  });
});
