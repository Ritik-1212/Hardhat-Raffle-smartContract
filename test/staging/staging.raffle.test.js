const { expect, assert } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { describe } = require("yargs");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", function () {
      let deployer, Raffle, entranceFee;
      const chainId = network.config.chainId;
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;

        entranceFee = await Raffle.getEntranceFee();
      });
      describe("fulfillRandomWords", function () {
        it("should be able to pick a winner and reset the lottery", async function () {
          const accounts = await ethers.getSigners();
          const startingTimeStamp = await Raffle.getLastTimeStsmp();

          await new promise(async function (resolve, reject) {
            Raffle.once("winner", async () => {
              try {
                const recentWinner = await Raffle.getRecentWinner();
                const endWinnerBalance = await accounts[0].getBalance();
                const numPlayers = await Raffle.getNumPlayers();
                const raffleState = await Raffle.getRaffleState();
                const endingTimeStamp = await Raffle.getLastTimeSatmp();
                assert.equal(recentWinner, accounts[0].address);
                assert.equal(numPlayers.toString(), "0");
                assert.equal(raffleState.toString(), "0");
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(
                  endWinnerBalance.toString(),
                  winnerStartingBalance.add(entranceFee).toString()
                );
                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
            const tx = await Raffle.enterRaffle({ value: entranceFee });
            await tx.wait(1);
            const winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
