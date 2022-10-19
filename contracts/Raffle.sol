// Raffle

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';

error Raffle__NotEnoughEntranceFee();
error Raffle__RaffleNotOpen();

contract Raffle is VRFConsumerBaseV2 {
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

    /* events */
    event RequestedRaffleWinner(uint256 indexed requestId);
    event RaffleEnter(address indexed player);
    event WinnerPicked(address indexed player);

    constructor(
        address _coordinatorAddr, 
        uint256 _entranceFee, 
        bytes32 _gasLane,
        uint64 _subscriptionId, 
        uint32 _callbackGasLimit        
    ) VRFConsumerBaseV2(_coordinatorAddr) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(_coordinatorAddr);
        i_entranceFee = _entranceFee;
        i_gasLane = _gasLane;
        i_subscriptionId = _subscriptionId;
        i_callbackGasLimit = _callbackGasLimit;
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

    // pick random winner - request
    // should be called from keeper
    function pickRandomWinner() public {
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
        uint256 winner_id = randomWords[0] % s_players.length;
        address payable winner = s_players[winner_id];
        s_winner = winner;
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

}