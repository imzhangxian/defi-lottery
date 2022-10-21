const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

! developmentChains.includes(network.name) ? describe.skip : describe("Raffle unit tests", () => {
    let raffleContract, vrfMock, entranceFee, interval, player
    let raffle // test player
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        player = accounts[1]
        await deployments.fixture("mocks", "raffle")
        vrfMock = await ethers.getContract("VRFCoordinatorV2Mock")
        raffleContract = await ethers.getContract("Raffle")
        raffle = raffleContract.connect(player)
        entranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
    })

    describe("constructor", () => {
        it("initialize raffle contract", async () => {
            const raffleState = (await raffle.getRaffleState()).toString()
            assert.equal(raffleState, 0)
            assert.equal(interval.toString(), networkConfig[network.config.chainId]["keepersUpdateInterval"])
        })
    })

    describe("enter raffle", () => {
        it("revert on insufficient funds", async () => {
            await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEntranceFee")
        })
        it("record player when enter", async () => {
            await raffle.enterRaffle({ value: entranceFee })
            const contractPlayer = await raffle.getPlayer(0)
            assert.equal(player.address, contractPlayer)
        })
        it("emits event on enter", async () => {
            await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                 // emits RaffleEnter event if entered to index player(s) address
                raffle,
                "RaffleEnter"
            )
        })
        it("doesn't allow entrance when raffle is calculating", async () => {
            await raffle.enterRaffle({ value: entranceFee })
            // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            // we pretend to be a keeper for a second
            await raffle.performUpkeep([]) // changes the state to calculating for our comparison below
            await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith( // is reverted as raffle is calculating
                "Raffle__RaffleNotOpen"
            )
        })
    })

    describe("check up keep", () => {
        it("return false if no balance / no player", async () => {
            // time passed -> true
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded, } = await raffle.callStatic.checkUpkeep("0x")
            assert (! upkeepNeeded)
        })
        it("return false if not open", async () => {
            // has balance + player
            await raffle.enterRaffle({ value: entranceFee })
            // time passed -> true
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({ method: "evm_mine", params: [] })
            // perform upkeep: status -> calculating
            await raffle.performUpkeep([])
            const raffleState = await raffle.getRaffleState()
            const { upkeepNeeded, } = await raffle.callStatic.checkUpkeep("0x")
            assert (raffleState.toString() == 1, upkeepNeeded == false)
        })
        it("return false if time not passed", async() => {
            // has balance + player, open
            await raffle.enterRaffle({ value: entranceFee })
            // not enough time passed
            await network.provider.send("evm_increaseTime", [interval.toNumber() - 5])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded, } = await raffle.callStatic.checkUpkeep("0x")
            const raffleState = await raffle.getRaffleState()
            assert (raffleState.toString() == 0, upkeepNeeded == false)
        })
        it("return true if all conditions met", async () => {
            await raffle.enterRaffle({ value: entranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 5])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded, } = await raffle.callStatic.checkUpkeep("0x")
            assert( upkeepNeeded )
        })
    })

    describe("perform keep up", () => {
        it("can run only keep up needed", async () => {
            await raffle.enterRaffle({ value: entranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 5])
            await network.provider.request({ method: "evm_mine", params: [] })
            const { upkeepNeeded, } = await raffle.callStatic.checkUpkeep("0x")
            const tx = await raffle.performUpkeep([])
            assert ( upkeepNeeded, tx)
        })
        it("throw an error if up keep not needed", async () => {
            await expect(raffle.performUpkeep([])).to.revertedWith(
                "Raffle__UpkeepNotNeeded"
            )
        })
        it("updates the raffle and return a requestId", async () => {
            await raffle.enterRaffle({ value: entranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({method: "evm_mine", params: []})
            const tx = await raffle.performUpkeep("0x")
            const rec = await tx.wait(1)
            const state = await raffle.getRaffleState()
            const requestId = rec.events[1].args.requestId
            assert (state.toString() == 1, requestId.toNumber() > 0)
        })
    })

    describe("fulfill random requests", () => {
        beforeEach(async () => {
            await raffle.enterRaffle({ value: entranceFee })
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            await network.provider.request({method: "evm_mine", params: []})
        })
        it("can only be called after perform up keep", async () => {
            await expect(vrfMock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
            await expect(vrfMock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
        })
        it("pick a winner, reset and send money", async () => {
            // pick 3 players
            const NUM_PLAYERS = 3
            const PLAYER_FROM = 2
            //enter raffle
            for (let i = PLAYER_FROM; i < PLAYER_FROM + NUM_PLAYERS; i ++) {
                raffle = raffleContract.connect(accounts[i])
                await raffle.enterRaffle({ value: entranceFee })
            }
            const startingTimestamp = await raffle.getLastTimeStamp()

            // add an event listener for WinnerPicked
            await new Promise(async (resolve, reject) => {
                console.log("Waiting WinnerPicked event to fire ...")
                raffle.once("WinnerPicked", async () => {
                    console.log("WinnerPicked event fired!")
                    try {
                        /*
                        const recentWinner = await raffle.getRecentWinner()
                        const winnerBalance = await accounts[2].getBalance()
                        // const raffleState = await raffle.getRaffleState()
                        // const endingTimeStamp = await raffle.getLastTimeStamp()
                        // expect players cleaned up
                        await expect(raffle.getPlayer(0)).to.be.reverted
                        // Comparisons to check if our ending values are correct:
                        assert.equal(recentWinner.toString(), accounts[2].address)
                        assert.equal(
                            winnerBalance.toString(), 
                            startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                .add(
                                    raffleEntranceFee
                                        .mul(additionalEntrances)
                                        .add(raffleEntranceFee)
                                )
                                .toString()
                        )
                        */
                        resolve()
                    } catch (e) {
                        reject(e)
                    }
                })
            })

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            const tx = await raffle.performUpkeep("0x")
            const receipt = await tx.wait(1)
            await vrfMock.fulfillRandomWords(
                receipt.events[1].args.requestId,
                raffle.address
            )
        })
    })

})