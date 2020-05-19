pragma solidity ^0.5.8;
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
contract FlightSuretyApp {
    using SafeMath for uint256;
    FlightSuretyData flightSuretyData;

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract
    mapping(address => bool) multiCalls;    // Mapping for storing multi-call addresses
    address[] multiCallKeys = new address[](0);

   

    uint8 private nonce = 0;                                    // Incremented to add pseudo-randomness at various points
    uint256 public constant REGISTRATION_FEE = 1 ether;         // Fee to be paid when registering oracle
    uint256 public constant MIN_RESPONSES = 3;                  // Number of oracles that must respond for valid status

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Responses from oracles. This lets us group responses and identify the response that majority of the oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported .
    }

    mapping(address => Oracle) private oracles;                 // Track all registered oracles
    mapping(bytes32 => ResponseInfo) private oracleResponses;   // Track all oracle responses: Key = hash(index, flight, timestamp)


    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational(){
        bool dataOperational = flightSuretyData.isOperational();        // Modify to call data contract's status
        require(dataOperational, "Contract is currently not operational");
        _;
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier isFunded(address wallet) {
        require(flightSuretyData.isAirlineFunded(wallet), "Airline is not funded");
        _;
    }

    modifier isAllowedToRegisterAirline() {
        if (msg.sender != contractOwner) {
            require(flightSuretyData.isAirlineRegistered(msg.sender), "Caller is not a registered airline");
            require(flightSuretyData.isAirlineFunded(msg.sender), "Airline is not funded");
        }
        _;
    }

    /********************************************************************************************/
    /*                     EVENT DEFINITIONS & CONSTRUCTOR                                      */
    /********************************************************************************************/
    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);
    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    /**
    * @dev Contract constructor
    *
    */
    constructor(address dataContract) public{
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns (bool){
        return flightSuretyData.isOperational();            // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function registerAirline(string calldata name, address wallet) external isAllowedToRegisterAirline returns (bool success, uint256 votes){
        require(!flightSuretyData.isAirlineRegistered(wallet), "Airline is already registered");
        uint airlineCount = flightSuretyData.getAirlineCount();
        uint votes_needed = airlineCount.div(2);
        if (airlineCount.mod(2) != 0) {
            votes_needed = votes_needed.add(1);
        }
        if (airlineCount < 4) {
            flightSuretyData.registerAirline(name, wallet);
            return (true, 1);
        } else {
            bool isDuplicate = multiCalls[msg.sender];
            require(!isDuplicate, "Caller has already called this function");
            multiCalls[msg.sender] = true;
            multiCallKeys.push(msg.sender);
            if (multiCallKeys.length >= votes_needed) {
                flightSuretyData.registerAirline(name, wallet);
                for (uint i = 0; i < multiCallKeys.length; ++i) {
                    multiCalls[multiCallKeys[i]] = false;
                }
                multiCallKeys = new address[](0);
                return (true, votes_needed);
            }
            return (false, multiCallKeys.length);
        }
    }

    function getFunds() external {
        flightSuretyData.pay(msg.sender);
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight(string calldata name, uint256 timestamp, address airline) external {
        flightSuretyData.registerFlight(name, timestamp, airline);
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode) internal{
        if (statusCode == 20) {
            flightSuretyData.creditInsurees(flight, timestamp, airline);
        }
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string calldata flight, uint256 timestamp) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({requester : msg.sender, isOpen : true});

        emit OracleRequest(index, airline, flight, timestamp);
    }


    // Register an oracle with the contract
    function registerOracle() external payable{
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");
        uint8[3] memory indexes = generateIndexes(msg.sender);
        oracles[msg.sender] = Oracle({isRegistered : true, indexes : indexes});
    }

    // function to call an array[3] which has random number of 0-9
    function getMyIndexes() view external returns (uint8[3] memory) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");
        return oracles[msg.sender].indexes;
    }


    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string calldata flight, uint256 timestamp, uint8 statusCode) external{
        require((oracles[msg.sender].indexes[0] == index)
        || (oracles[msg.sender].indexes[1] == index)
            || (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function buyInsurance( string calldata flight, uint256 timestamp, address airline) external payable {
        require(msg.value > 0, 'Cannot buy insurance without funds');
        flightSuretyData.buy.value(msg.value)(flight, timestamp, airline, msg.sender);
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) pure internal returns (bytes32){
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account)internal returns (uint8[3] memory){
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns non-duplicating integers from 0-9
    function getRandomIndex (address account)internal returns (uint8){
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;      // Can only fetch blockhashes for last 256 blocks so we adapt
        }
        return random;
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable{
        flightSuretyData.fundForwarded.value(msg.value)(msg.sender);
    }
}

contract FlightSuretyData {
    function isOperational() external view returns (bool);

    function setOperatingStatus(bool mode) external;

    function isAirlineRegistered(address wallet) external view returns (bool);

    function isAirlineFunded(address wallet) external view returns (bool);

    function registerAirline(string calldata name, address wallet) external;

    function getAirlineCount() external view returns (uint256);

    function isFlightRegistered(string calldata name, uint256 timestamp, address airline) external view returns (bool);

    function registerFlight(string calldata name, uint256 timestamp, address airline) external;

    function buy(string calldata flight, uint256 timestamp, address airline, address insuree) external payable;

    function creditInsurees(string calldata flight, uint256 timestamp, address airline) external;

    function pay(address payable insuree) external;

    function fundForwarded(address sender) external payable;

}