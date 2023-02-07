const { expect, assert } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");

const { describe } = require("yargs");
const { networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", function () {
      let deployer, Raffle, VRFCoordinatorV2Mock, entranceFee, interval;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        Raffle = await ethers.getContract("Raffle", deployer);
        VRFCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        );
        entranceFee = await Raffle.getEntranceFee();
        interval = await Raffle.getInterval();
      });
      describe("constructor", function () {
        it("should be able to initialize the state variables", async function () {
          const raffleState = await Raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval, networkConfig[chainId]["interval"]);
        });
      });
      describe("enterRaffle", function () {
        it("should be able to enter the raffle", async function () {
          await expect(Raffle.enterRaffle()).to.be.revertedWith(
            "Raffle__notEnughETH"
          );
        });
        it("should be able to store the players entering the raffle", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          const response = await Raffle.getPlayer(0);
          assert.equal(player, deployer);
        });
        it("should be able to emit the players entering the raffle", async function () {
          await expect(Raffle.enterRaffle({ value: entranceFee })).to.emit(
            Raffle,
            "rafflePlayer"
          );
        });
        it("should not be able to enter the raffle if raffle is not open", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await Raffle.performUpKeep([]);
          await expect(
            Raffle.enterRaffle({ value: entranceFee })
          ).to.be.revertedWith("Raffle__notopen");
        });
      });
      describe("checkUpKeep", function () {
        it("should return false if not enough ETH is spent", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpKeep([]);
          assert(!upKeepNeeded);
        });
        it("should not check upkeep if raffle is not open", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await Raffle.performUpKeep([]);
          const RaffleState = await Raffle.getRaffleState();
          const { upKeepNeeded } = await Raffle.callStatic.checkUpKeep([]);
          assert.equal(RaffleState.toString(), "1");
          assert.equal(upKeepNeeded, false);
        });
        it("should return false if enough time has not passed", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpKeep([]);
          assert(!upKeepNeeded);
        });
        it("should return true if upkeep is needed", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upKeepNeeded } = await Raffle.callStatic.checkUpKeep([]);
          assert(upKeepNeeded);
        });
      });
      describe("performUpKeep", function () {
        it("returns true if upkeep is needed", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_inctreaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await Raffle.performUpKeep([]);
          assert(tx);
        });
        it("reverts when upkeep is not needed", async function () {
          await expect(
            Raffle.performUpKeep([]).to.be.revertedWith(
              "Raffle__upKeepNotNeeded"
            )
          );
        });
        it("checks the raffle state emits the event and checks for the requestId", async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_inctreaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await Raffle.performUpKeep([]);
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.events[1].args.requestId;
          const RaffleState = await Raffle.getRaffleState();
          assert(requestId.toNumber() > 1);
          assert(RaffleState.toString(), "1");
        });
      });
      describe("fullfillRandomWords", function () {
        beforeEach(async function () {
          await Raffle.enterRaffle({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });
        it("reverts if up keep is not performed", async function () {
          await expect(
            VRFCoordinatorV2Mock.fullfillRandomWords(0, Raffle.address)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            VRFCoordinatorV2Mock.fullfillRandomWords(1, Raffle.address)
          ).to.be.revertedWith("nonexistent request");
        });
        it("emits the event , resets the players and sends the money to the winner", async function () {
          const additionalPlayers = 3;
          const subPlayerIndex = 1;
          const accounts = await ethers.getSigners();

          for (
            let i = subPlayerIndex;
            i < subPlayerIndex + additionalPlayers;
            i++
          ) {
            const RaffeConnectedAccounts = await Raffle.connect(accounts[i]);
            await RaffleConnectedAccounts.enterRaffle({ value: entranceFee });
          }
          const startingTimeStamp = await Raffle.getLastTimeSatmp();
          await new promise((resolve, reject) => {
            Raffle.once("winner", async () => {
              try {
                console.log(recentWinner);
                console.log(accounts[1].address);
                console.log(accounts[2].address);
                console.log(accounts[3].address);
                const recentWinner = await Raffle.getRecentWinner();
                const numPlayers = await Raffle.getNumPlayers();
                const raffleState = await Raffle.getRaffleState();
                const endingTimeStamp = await Raffle.getLastTimeSatmp();

                assert.equal(raffleState.toString(), "0");
                assert.equal(numPlayers.toString(), "0");
                assert(endingTimeStamp > startingTimeStamp);

                assert;
              } catch (e) {
                reject(e);
              }
              resolve();
            });
          });

          const tx = await Raffle.performUpKeep([]);
          const txReceipt = await tx.wait(1);

          await VRFCoordinatorV2Mock.fullfillRandomWords(
            txReceipt.events[1].args.requestId,
            Raffle.address
          );
        });
      });
    });
