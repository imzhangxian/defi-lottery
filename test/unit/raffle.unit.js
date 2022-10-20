const { inputToConfig } = require('@ethereum-waffle/compiler')
const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')

! developmentChains.includes(network.name) ? describe.skip : describe("Raffle unit tests", () => {
    let raffle, raffleContract, vrfMock, entranceFee, interval, player1, player2
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
    })

    describe("constructor", () => {
        it("initialize raffle contract", async () => {
            const raffleState = (await raffle.getRaffleState()).toString()
            assert.equal(raffleState, 0)
            assert.equal(interval.toString(), networkConfig[network.config.chainId]["keepersUpdateInterval"])
        })
    })

    describe("enter raffle", () => {
        
    })

})