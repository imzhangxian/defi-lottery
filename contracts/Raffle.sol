// Raffle

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol';

error Raffle__NotEnoughEntranceFee();
error Raffle__RaffleNotOpen();
error Raffle__TransferFailed();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private s_winner;
    RaffleState private s_raffleState;

    // parameters for random request
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // parameters for up keeper
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    /* events */
    event RequestedRaffleWinner(uint256 indexed requestId);
    event RaffleEnter(address indexed player);
    event WinnerPicked(address indexed player);

    constructor(
        address _coordinatorAddr, 
        uint256 _entranceFee, 
        bytes32 _gasLane,
        uint64 _subscriptionId, 
        uint32 _callbackGasLimit, 
        uint256 _interval
    ) VRFConsumerBaseV2(_coordinatorAddr) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(_coordinatorAddr);
        i_entranceFee = _entranceFee;
        i_gasLane = _gasLane;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
        i_interval = _interval;
        s_lastTimeStamp = block.timestamp;
    }

    // enter lottery 
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEntranceFee();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__RaffleNotOpen();
        }
        s_players.push(payable(msg.sender));
        // emit an event
        emit RaffleEnter(msg.sender);
    }

    // check up keeper
    function checkUpkeep(bytes memory) public view override returns (bool upkeepNeeded, bytes memory) {
        bool isOpen = (s_raffleState == RaffleState.OPEN);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        // ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool timePassed = block.timestamp > s_lastTimeStamp + i_interval;
        upkeepNeeded = (isOpen && hasPlayers && hasBalance && timePassed);
        // Root cause should be performUpkeep reverted by unregistered VRF; 
        // should have nothing to do with performData
        return (upkeepNeeded, "0x");
    }

    // pick random winner - request
    // should be called from keeper
    function performUpkeep(bytes calldata) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (! upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        // get a random (chainlink VRF)
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedRaffleWinner(requestId);
    }

    // call back from coordinator, 
    // pick and reward the winner
    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        // pick a winner
        uint256 winner_id = randomWords[0] % s_players.length;
        address payable winner = s_players[winner_id];
        s_winner = winner;
        // settle the prize to winner
        (bool success, ) = winner.call{value: address(this).balance}("");
        if (! success) {
            revert Raffle__TransferFailed();
        }
        // clean up players
        s_players = new address payable[](0);
        // reset timestamp
        s_lastTimeStamp = block.timestamp;
        // re-open raffle
        s_raffleState = RaffleState.OPEN;
        emit WinnerPicked(winner);
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_winner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

        function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }


}