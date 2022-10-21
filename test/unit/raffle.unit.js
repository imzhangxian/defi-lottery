const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

! developmentChains.includes(network.name) ? describe.skip : describe("Raffle unit tests", () => {
    let raffleContract, vrfMock, entranceFee, interval, player1, player2
    let raffle, raffle02 // test players
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        player1 = accounts[1]
        player2 = accounts[2]
        await deployments.fixture("mocks", "raffle")
        vrfMock = await ethers.getContract("VRFCoordinatorV2Mock")
        raffleContract = await ethers.getContract("Raffle")
        raffle = raffleContract.connect(player1)
        entranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
        raffle02 = raffleContract.connect(player2)
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
            const contractPlayer01 = await raffle.getPlayer(0)
            assert.equal(player1.address, contractPlayer01)

            await raffle02.enterRaffle({ value: entranceFee })
            const contractPlayer02 = await raffle02.getPlayer(1)
            assert.equal(player2.address, contractPlayer02)
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
        it("", async () => {
        })
    })

})