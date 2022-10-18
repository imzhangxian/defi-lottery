const { network } = require("hardhat")

const BASE_FEE = "250000000000000000"
const GAS_PRICE_LINK = 1e9

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  if (chainId === 31337) {
    log("local network detected. deploying mock ...")
    await deploy(
      "VRFCoordinatorV2Mock",
      {
        from: deployer,
        log: true,
        args: [BASE_FEE, GAS_PRICE_LINK]
      }
    )
    log("Mocks Deployed!")
  }
}

module.exports.tags = ["all", "mocks"]