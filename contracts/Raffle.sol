//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

/*imports */
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

/*errors */
error Raffle__notEnoughETH();
error Raffle__transferFailed();
error Raffle__notopen();
error Raffle__upKeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 RaffleState
);

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /**@title Hardhat-raffle-SmartContract
     * @author Ritik raj
     * @notice this is a decentralized smart contract in which players can enter in lottery
     * @dev this uses chainlink VRF for randomness and chainlink Keepers for automation
     */

    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* state variables*/
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    /*constant state variables */
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    /*lottery variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimestamp;
    uint256 private immutable i_interval;

    /*events */
    event rafflePlayer(address indexed player);
    event requestRandomWinner(uint256 indexed requestId);
    event winner(address indexed recentWinner);

    /*functions */
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimestamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__notEnoughETH();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__notopen();
        }
        s_players.push(payable(msg.sender));
        emit rafflePlayer(msg.sender);
    }

    /// @dev this method is called by the Automation Nodes to check if `performUpkeep` should be performed
    function checkUpkeep(
        bytes memory /* calldata /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimestamp) > i_interval);
        bool minPlayers = (s_players.length > 0);
        bool minBalance = (address(this).balance > 0);

        upkeepNeeded = (isOpen && timePassed && minPlayers && minBalance);
        return (upkeepNeeded, "0x0");
    }

    /// @dev this method is called by the Automation Nodes. it increases all elements which balances are lower than the LIMIT
    function performUpkeep(
        bytes memory /* /* performData */
    ) external override {
        (bool upKeepNeeded, ) = checkUpkeep("");
        if (!upKeepNeeded) {
            revert Raffle__upKeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        // Will revert if subscription is not set and funded.
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit requestRandomWinner(requestId);
    }

    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        uint256 indexNumber = _randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexNumber];
        s_recentWinner = recentWinner;
        s_players = new address payable[](0);
        s_lastTimestamp = block.timestamp;
        s_raffleState = RaffleState.OPEN;
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__transferFailed();
        }

        emit winner(recentWinner);
    }

    /*view/pure getter functions */
    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getGasLane() public view returns (bytes32) {
        return i_gasLane;
    }

    function getSubscriptionId() public view returns (uint256) {
        return i_subscriptionId;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimestamp;
    }

    function getNumPlayers() public view returns (uint256) {
        return s_players.length;
    }
}
