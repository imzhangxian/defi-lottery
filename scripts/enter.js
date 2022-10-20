const { ethers } = require("hardhat")

async function enterRaffle() {
    const raffle = await ethers.getContract("Raffle")
    const entranceFee = await raffle.getEntranceFee()

    console.log(`enter raffle with fee: ${entranceFee}`)

    await raffle.enterRaffle({ value: entranceFee })
    console.log("Entered!")
    
}

enterRaffle()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
