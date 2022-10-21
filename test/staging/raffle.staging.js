const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", () => {
        let raffle, entranceFee, deployer
        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle")
            entranceFee = await raffle.getEntranceFee()
        })
        describe("fulfill random words", () => {
            it("Test raffle on staging chain with live vrf and upkeeper", async () => {
                const accounts = await ethers.getSigners()
                await new Promise(async (resolve, reject) => {
                    // register an event listener on winner picked
                    raffle.once("WinnerPicked", async () => {
                        console.log("Winner Picked!!")
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerBalance = await accounts[0].getBalance()
                            // expect state reset
                            assert.equal(raffleState, 0)
                            // expect players cleaned up
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            // winner expected to be the only player
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            // Comparisons to check if our ending values are correct:
                            assert.equal(
                                winnerBalance.toString(),
                                winnerStartingBalance.add(entranceFee).toString()
                            )
                            resolve()
                        } catch (e) {
                            reject(e)
                        }
                    })

                    // enter raffle with only one player
                    console.log("Entering Raffle")
                    const tx = await raffle.enterRaffle({ value: entranceFee })
                    await tx.wait(1)
                    console.log("Ok, time to wait...")
                    const winnerStartingBalance = await accounts[0].getBalance()
                })
            })
        })
    })