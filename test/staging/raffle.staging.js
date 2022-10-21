const { assert, expect } = require('chai')
const { network, deployments, ethers } = require('hardhat')
const { developmentChains, networkConfig } = require('../../helper-hardhat-config')


developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", () => {
        beforEach(async () => {

        })
        describe("", () => {
            it("", async () => {

            })
        })
    })