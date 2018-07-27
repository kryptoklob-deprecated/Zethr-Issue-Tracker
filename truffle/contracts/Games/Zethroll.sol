pragma solidity ^0.4.23;

// ZETHROLL UPDATE
// TODO:
// reduce a LOT of gas by using a struct for rolls, right now we are wasting gas
// TEST it
// dividends from token should be payout to bankroll

/*
* Zethroll.
*
* Adapted from PHXRoll, written in March 2018 by TechnicalRise:
*   https://www.reddit.com/user/TechnicalRise/
*
*/

contract ZTHReceivingContract {
  /**
   * @dev Standard ERC223 function that will handle incoming token transfers.
   *
   * @param _from  Token sender address.
   * @param _value Amount of tokens.
   * @param _data  Transaction metadata.
   */
  function tokenFallback(address _from, uint _value, bytes _data) public returns (bool);
}


contract ZTHInterface {
  function getFrontEndTokenBalanceOf(address who) public view returns (uint);
  function transfer(address _to, uint _value) public returns (bool);
  function approve(address spender, uint tokens) public returns (bool);
}

contract Zethroll is ZTHReceivingContract {
  using SafeMath for uint;

  /*
   * checks player profit, bet size and player number is within range
  */
  modifier betIsValid(uint _betSize, uint _playerNumber) {

    emit Debug(_betSize, 'betsize');
    emit Debug(minBet, 'minBet');
    emit Debug(calculateProfit(_betSize, _playerNumber), 'calcProfit');
    emit Debug(maxProfit, 'maxProfit');
     require( calculateProfit(_betSize, _playerNumber) < maxProfit
             && _betSize >= minBet
             && _playerNumber > minNumber
             && _playerNumber < maxNumber);
    _;
  }

  // Requires game to be currently active
  modifier gameIsActive {
    require(gamePaused == false);
    _;
  }

  // Requires payouts to be currently active
  modifier payoutsAreActive {
    require(payoutsPaused == false);
    _;
  }

  // Requires msg.sender to be owner
  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  // Requires msg.sender to be bankroll
  modifier onlyBankroll {
    require(msg.sender == bankroll);
    _;
  }

  // Constants
  uint constant private MAX_INT = 2 ** 256 - 1;
  uint constant public maxProfitDivisor = 1000000;
  uint constant public maxNumber = 99;
  uint constant public minNumber = 2;
  uint constant public houseEdgeDivisor = 1000;

  // Configurables
  bool public gamePaused;
  bool public payoutsPaused;

  address public owner;
  address public bankroll;
  address public ZTHTKNADDR;

  ZTHInterface public ZTHTKN;

  uint public contractBalance;
  uint public houseEdge;
  uint public maxProfit;
  uint public maxProfitAsPercentOfHouse;
  uint public minBet = 0;

  // Info
  uint public totalBetsWon = 0;
  uint public totalZTHWagered = 0;
  int public totalBets = 0;

  // Internal
  uint internal _seed;

  // Player vars
  uint public rngId;
  mapping(uint => address) playerAddress;
  mapping(uint => uint) playerBetId;
  mapping(uint => uint) playerBetValue;
  mapping(uint => uint) playerDieResult;
  mapping(uint => uint) playerNumber;
  mapping(uint => uint) playerProfit;
  mapping(address => uint) playerTargetBet;
  mapping(uint => uint) playerBlock;
  mapping(uint => TKN) playerTKN;
  mapping(uint => uint) playerRollUnder;

  // Events

  // Logs bets + output to web3 for precise 'payout on win' field in UI
  event LogBet(uint indexed BetID, address indexed PlayerAddress, uint indexed RewardValue, uint ProfitValue, uint BetValue, uint PlayerNumber);

  // Outputs to web3 UI on bet result
  // Status: 0=lose, 1=win, 2=win + failed send, 3=refund, 4=refund + failed send
  event LogResult(uint indexed BetID, address indexed PlayerAddress, uint PlayerNumber, uint DiceResult, uint Value, int Status);

  // Logs manual refunds
  event LogRefund(uint indexed BetID, address indexed PlayerAddress, uint indexed RefundValue);

  // Logs owner transfers
  event LogOwnerTransfer(address indexed SentToAddress, uint indexed AmountTransferred);

  // Logs changes in maximum profit
  event MaxProfitChanged(uint _oldMaxProfit, uint _newMaxProfit);

  // Logs current contract balance
  event CurrentContractBalance(uint _tokens);

  constructor (address zthtknaddr, address zthbankrolladdr) public {
    // Owner is deployer
    owner = msg.sender;

    // Initialize the ZTH contract and bankroll interfaces
    ZTHTKN = ZTHInterface(zthtknaddr);
    ZTHTKNADDR = zthtknaddr;

    // Init 990 = 99% (1% houseEdge)
    houseEdge = 990;

    // The maximum profit from each bet is 1% of the contract balance.
    ownerSetMaxProfitAsPercentOfHouse(10000);

    // Init min bet (1 ZTH)
    ownerSetMinBet(1e18);

    // Allow 'unlimited' token transfer by the bankroll
    ZTHTKN.approve(zthbankrolladdr, MAX_INT);

    // Set the bankroll
    bankroll = zthbankrolladdr;
  }

  function() public payable {} // receive zethr dividends

  // Returns a random number using a specified block number
  // Always use a FUTURE block number.
  function maxRandom(uint blockn) public returns (uint256 randomNumber) {
    _seed = uint256(keccak256(
        abi.encodePacked(_seed,
        blockhash(blockn),
        block.coinbase,
        block.difficulty)
      ));
    return _seed;
  }

  // Random helper
  function random(uint256 upper, uint256 blockn) internal returns (uint256 randomNumber) {
    return maxRandom(blockn) % upper;
  }

  /*
   * TODO comment this Norsefire, I have no idea how it works
   */
  function calculateProfit(uint _initBet, uint _roll)
    private
    view
    returns (uint)
  {
    return ((((_initBet * (100 - (_roll.sub(1)))) / (_roll.sub(1)) + _initBet)) * houseEdge / houseEdgeDivisor) - _initBet;
  }

  /*
   * public function
   * player submit bet
   * only if game is active & bet is valid
  */
  event Debug(uint a, string b);

  function _playerRollDice(uint _rollUnder, TKN _tkn) private
    gameIsActive
    betIsValid(_tkn.value, _rollUnder)
  {
    // Note that msg.sender is the Token Contract Address
    // and "_from" is the sender of the tokens

    // Check that this is a non-contract sender
    require(_humanSender(_tkn.sender));

    // Check that this is a ZTH token transfer
    require(_zthToken(msg.sender));

    // Check that this is a ZTH Token Transfer
    require(block.number != playerBlock[playerTargetBet[_tkn.sender]]);

    if (playerBlock[playerTargetBet[_tkn.sender]] != 0) {
      _finishBet(playerTargetBet[_tkn.sender]);
    }

    // Increment rngId
    rngId++;

    // Map bet id to this wager
    playerBetId[rngId] = rngId;

    // Map player lucky number
    playerNumber[rngId] = _rollUnder;

    // Map value of wager
    playerBetValue[rngId] = _tkn.value;

    // Map player address
    playerAddress[rngId] = _tkn.sender;

    // Safely map player profit
    playerProfit[rngId] = 0;

    playerBlock[rngId] = block.number;
    playerTargetBet[_tkn.sender] = rngId;
    playerTKN[rngId] = _tkn;
    playerRollUnder[rngId] = _rollUnder;

    // Provides accurate numbers for web3 and allows for manual refunds
    emit LogBet(playerBetId[rngId], playerAddress[rngId],
                 playerBetValue[rngId].add(playerProfit[rngId]),
                 playerProfit[rngId], playerBetValue[rngId], playerNumber[rngId]);

    // Increment total number of bets
    totalBets += 1;

    // Total wagered
    totalZTHWagered += playerBetValue[rngId];
  }

  /*
   * Pay winner, update contract balance
   * to calculate new max bet, and send reward.
   */
  function _finishBet(uint _rngId) public returns (uint result) {

    // If the block is more than 255 blocks old, we can't get the result
    // Also, if the result has alread happened, fail as well
    if (block.number - playerBlock[_rngId] > 255 || _rngId == 0) {
      playerDieResult[_rngId] = 1000;
      // Fail
    } else {
      playerDieResult[_rngId] = random(99, playerBlock[_rngId]) + 1;
    }

		// Null out this bet so it can't be used again.
		playerBlock[_rngId] = 0;

    emit Debug(playerDieResult[_rngId], 'LuckyNumber');

    TKN storage _tkn = playerTKN[_rngId];
    uint _rollUnder = playerRollUnder[_rngId];

    if (playerDieResult[_rngId] < playerNumber[_rngId]) {
      // Player has won!

      // Safely map player profit
      playerProfit[_rngId] = calculateProfit(_tkn.value, _rollUnder);

      // Safely reduce contract balance by player profit
      contractBalance = contractBalance.sub(playerProfit[_rngId]);

      emit LogResult(playerBetId[_rngId], playerAddress[_rngId], playerNumber[_rngId],
                      playerDieResult[_rngId], playerProfit[_rngId], 1);

      // Update maximum profit
      setMaxProfit();

      // Transfer profit plus original bet
      ZTHTKN.transfer(playerAddress[_rngId], playerProfit[_rngId] + _tkn.value);

    } else {
      /*
      * Player has lost
      * Update contract balance to calculate new max bet
      */
      emit LogResult(playerBetId[_rngId], playerAddress[_rngId], playerNumber[_rngId],
                      playerDieResult[_rngId], playerBetValue[_rngId], 0);

      /*
      *  Safely adjust contractBalance
      *  SetMaxProfit
      */
      contractBalance = contractBalance.add(playerBetValue[_rngId]);

      // Update maximum profit
      setMaxProfit();
    }

    result = playerDieResult[_rngId];
    return result;
  }

  struct TKN {address sender; uint value;}

  function tokenFallback(address _from, uint _value, bytes _data) public returns (bool) {
    if (_from == bankroll) {
      // Update the contract balance
      contractBalance = contractBalance.add(_value);

      // Update the maximum profit
      uint oldMaxProfit = maxProfit;
      setMaxProfit();

      emit MaxProfitChanged(oldMaxProfit, maxProfit);
      return true;

    } else {
      TKN memory _tkn;
      _tkn.sender = _from;
      _tkn.value = _value;
      uint chosenNumber = uint(_data[0]);
      _playerRollDice(chosenNumber, _tkn);
    }
    return true;
  }

  /*
  * Sets max profit
  */
  function setMaxProfit() internal {
    emit CurrentContractBalance(contractBalance);
    maxProfit = (contractBalance * maxProfitAsPercentOfHouse) / maxProfitDivisor;
  }

  // Only owner adjust contract balance variable (only used for max profit calc)
  function ownerUpdateContractBalance(uint newContractBalance) public
  onlyOwner
  {
    contractBalance = newContractBalance;
  }

  // Only owner address can set maxProfitAsPercentOfHouse
  function ownerSetMaxProfitAsPercentOfHouse(uint newMaxProfitAsPercent) public
  onlyOwner
  {
    // Restricts each bet to a maximum profit of 1% contractBalance
    require(newMaxProfitAsPercent <= 10000);
    maxProfitAsPercentOfHouse = newMaxProfitAsPercent;
    setMaxProfit();
  }

  // Only owner address can set minBet
  function ownerSetMinBet(uint newMinimumBet) public
  onlyOwner
  {
    minBet = newMinimumBet;
  }

  // Only owner address can transfer ZTH
  function ownerTransferZTH(address sendTo, uint amount) public
  onlyOwner
  {
    // Safely update contract balance when sending out funds
    contractBalance = contractBalance.sub(amount);

    // update max profit
    setMaxProfit();
    require(ZTHTKN.transfer(sendTo, amount));
    emit LogOwnerTransfer(sendTo, amount);
  }

  // Only owner address can set emergency pause #1
  function ownerPauseGame(bool newStatus) public
  onlyOwner
  {
    gamePaused = newStatus;
  }

  // Only owner address can set emergency pause #2
  function ownerPausePayouts(bool newPayoutStatus) public
  onlyOwner
  {
    payoutsPaused = newPayoutStatus;
  }

  // Only owner address can set bankroll address
  function ownerSetBankroll(address newBankroll) public
  onlyOwner
  {
    ZTHTKN.approve(bankroll, 0);
    bankroll = newBankroll;
    ZTHTKN.approve(newBankroll, MAX_INT);
  }

  // Only owner address can set owner address
  function ownerChangeOwner(address newOwner) public
  onlyOwner
  {
    owner = newOwner;
  }

  // Only owner address can selfdestruct - emergency
  function ownerkill() public
  onlyOwner
  {
    ZTHTKN.transfer(owner, contractBalance);
    selfdestruct(owner);
  }

  function _zthToken(address _tokenContract) private view returns (bool) {
    return _tokenContract == ZTHTKNADDR;
    // Is this the ZTH token contract?
  }

  // Determine if the "_from" address is a contract
  function _humanSender(address _from) private view returns (bool) {
    uint codeLength;
    assembly {
      codeLength := extcodesize(_from)
    }
    return (codeLength == 0);
    // If this is "true" sender is most likely a Wallet
  }

}

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint a, uint b) internal pure returns (uint) {
    if (a == 0) {
      return 0;
    }
    uint c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint a, uint b) internal pure returns (uint) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint a, uint b) internal pure returns (uint) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint a, uint b) internal pure returns (uint) {
    uint c = a + b;
    assert(c >= a);
    return c;
  }
}
