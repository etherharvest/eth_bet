pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title BetCycleBasic
 * @dev Basic bet cycle contract..
 */
contract BetCycleBasic is Ownable {
  using SafeMath for uint256;

  /**
   * @dev Event triggered on successful betting.
   * @param gambler Gambler address.
   * @param prediction Prediction.
   * @param bet Amount of money bet.
   */
  event Bet(
    address indexed gambler,
    bytes32 indexed prediction,
    uint256 bet
  );

  /**
   * @dev Event triggered when a bet is cancelled.
   * @param gambler Gambler address.
   * @param prediction Prediction.
   * @param bet Amount of money bet.
   */
  event BetCancelled(
    address indexed gambler,
    bytes32 indexed prediction,
    uint256 bet
  );

  /**
   * @dev Event triggered when the outcome of the bet has been set.
   * @param outcome Outcome.
   * @param payout Prize per wei.
   */
  event Outcome(
    bytes32 indexed outcome,
    uint256 payout
  );

  /**
   * @dev Event triggered when a gambler requested a refund.
   * @param gambler Gambler address.
   * @param amount Amount returned.
   */
  event Refund(
    address indexed gambler,
    uint256 amount
  );

  /**
   * @dev Event triggered when a prize has been claimed.
   * @param winner Winner address.
   * @param prize Prized amount.
   */
  event ClaimedPrize(
    address indexed winner,
    uint256 prize
  );

  //////////////////
  // Betting periods

  /**
   * @dev Betting cycle start block.
   */
  uint256 public bettingBlock;

  /**
   * @dev Outcome publishing cycle start block.
   */
  uint256 public publishingBlock;

  /**
   * @dev Claiming cycle start block.
   */
  uint256 public claimingBlock;

  /**
   * @dev Ending betting start block.
   */
  uint256 public endingBlock;

  /**
   * @dev Outcome of the bet.
   */
  bytes32 public outcome;

  /**
   * @dev Prize per wei.
   */
  uint256 public payout;

  /**
   * @dev When is on the betting period (∞, bettingBlock].
   */
  modifier isBettingPeriod() {
    require( block.number <= bettingBlock );
    _;
  }

  /**
   * @dev When is on the publishing period [publishingBlock, claimingBlock).
   */
  modifier isPublishingPeriod() {
    require( publishingBlock <= block.number && block.number < claimingBlock);
    _;
  }

  /**
   * @dev When is on the claiming period [claimingBlock, endingBlock).
   */
  modifier isClaimingPeriod() {
    require( claimingBlock <= block.number && block.number < endingBlock );
    _;
  }

  /**
   * @dev When the betting cycle has ended [endingBlock, ∞).
   */
  modifier hasEnded() {
    require( endingBlock <= block.number );
    _;
  }

  /**
   * @dev When has outcome.
   */
  modifier hasOutcome() {
    require( outcome != 0x0 );
    _;
  }

  /**
   * @dev When has not outcome.
   */
  modifier hasNoOutcome() {
    require( outcome == 0x0 );
    _;
  }

  /**
   * @dev When the prize or the refund has not been claimed.
   */
  modifier hasNotClaimed() {
    require( !_claimed[msg.sender] );
    _;
  }

  /**
   * @dev When the gambler has won.
   */
  modifier hasWon() {
    require( _predictions[msg.sender] == outcome );
    _;
  }

  //////////////////////
  // Betting information

  /**
   * @dev Bets by address.
   */
  mapping(address => uint256) _bets;

  /**
   * @dev Predictions by address.
   */
  mapping(address => bytes32) _predictions;

  /**
   * @dev Prediction count by predictions.
   */
  mapping(bytes32 => uint256) _count;

  /**
   * @dev Whether the address claimed the prize or not.
   */
  mapping(address => bool) _claimed;

  /**
   * @dev When the gambler has not bet.
   */
  modifier hasNotBet() {
    require( _bets[msg.sender] == 0 );          // Has not bet
    require( _predictions[msg.sender] == 0x0 ); // Has no valid prediction
    _;
  }

  /**
   * @dev When the gambler has bet.
   */
  modifier hasBet() {
    require( _bets[msg.sender] > 0 );           // Has a bet
    require( _predictions[msg.sender] != 0x0 ); // Has valid prediction
    _;
  }

  /**
   * @dev Given offsets, starts a betting cycle.
   * @param bettingOffset Betting offset from the creation block.
   * @param publishingOffset Result publishing offset. Must be greater than
   * bettingOffset.
   * @param claimingOffset Claiming offset from the creation block. Must be
   * greater than the publishingOffset.
   * @param endingOffset Bet cycle ending block offset from the creation block.
   * Must be greater than the claimingOffset.
   */
  constructor(
    uint256 bettingOffset,
    uint256 publishingOffset,
    uint256 claimingOffset,
    uint256 endingOffset
  ) public {
    require(bettingOffset < publishingOffset);
    require(publishingOffset < claimingOffset);
    require(claimingOffset < endingOffset);

    bettingBlock = block.number.add(bettingOffset);
    publishingBlock = block.number.add(publishingOffset);
    claimingBlock = block.number.add(claimingOffset);
    endingBlock = block.number.add(endingOffset);

    outcome = 0x0;
    payout = 0;
  }

  //////////////////////////////
  // Information views functions

  /**
   * @dev Gets the prediction of a gambler.
   * @param gambler Address of the gambler.
   * @return Prediction of the gambler.
   */
  function getPrediction(address gambler) public view returns (bytes32) {
    return _predictions[gambler];
  }

  /**
   * @dev Gets the amount bet by a gambler.
   * @param gambler Address of the gambler
   * @return Amount of Ether bet.
   */
  function getBet(address gambler) public view returns (uint256) {
    return _bets[gambler];
  }

  /**
   * @dev Gets amount of support for a bet.
   * @param prediction Prediction.
   * @return Prediction support.
   */
  function getSupport(bytes32 prediction) public view returns (uint256) {
    return _count[prediction];
  }

  ///////////////////////////
  // Betting period functions

  /**
   * @dev Bets an amount of Ether on a prediction.
   * @param prediction Prediction.
   * @return Whether the bet was set or not.
   */
  function bet(bytes32 prediction)
      public hasNotBet isBettingPeriod payable returns (bool) {
    require( prediction != 0x0 );
    require( msg.value > 0 );

    _bets[msg.sender] = msg.value;
    _predictions[msg.sender] = prediction;
    _count[prediction] = _count[prediction].add(msg.value);

    emit Bet(msg.sender, prediction, msg.value);

    return true;
  }

  /**
   * @dev Cancels a bet returning the bet Ether to the sender.
   * @return Whether the bet was cancelled or not.
   */
  function cancelBet()
      public hasBet isBettingPeriod returns (bool) {
    bytes32 prediction = getPrediction(msg.sender);
    uint256 amount = getBet(msg.sender);

    delete _bets[msg.sender];
    delete _predictions[msg.sender];

    uint256 count = _count[prediction].sub(amount);
    if ( count == 0 ) {
      delete _count[prediction];
    } else {
      _count[prediction] = count;
    }

    msg.sender.transfer(amount);

    emit BetCancelled(msg.sender, prediction, amount);

    return true;
  }

  //////////////////////////////
  // Publishing period functions

  /**
   * @dev Sets outcome of the bet.
   * @param _outcome Outcome of the bet.
   * @return Whether the outcome has been set or not.
   */
  function setOutcome(bytes32 _outcome)
      public onlyOwner hasNoOutcome isPublishingPeriod returns (bool) {
    uint256 winnerPool = _count[_outcome];

    require( _outcome != 0x0 );

    outcome = _outcome;

    uint256 totalPool = address(this).balance;
    if ( 0 < winnerPool && winnerPool <= totalPool ) {
      payout = totalPool.div(winnerPool);
    } else {
      payout = 0;
    }

    emit Outcome(outcome, payout);

    return true;
  }

  ////////////////////////////
  // Claiming period functions

  /**
   * @dev Refunds the ether when the outcome is not set on time.
   * @return Whether the ether was returned or not.
   */
  function refund() public hasBet hasNoOutcome hasNotClaimed returns (bool) {
    require( claimingBlock <= block.number );

    uint256 amount = getBet(msg.sender);

    _claimed[msg.sender] = true;

    msg.sender.transfer(amount);

    emit Refund(msg.sender, amount);

    return true;
  }

  /**
   * @dev Sends the prize to the winner.
   * @return Whether the prize was transferred or not.
   */
  function claim()
      public hasBet hasOutcome isClaimingPeriod hasNotClaimed hasWon
      returns (bool) {
    uint256 amount = _bets[msg.sender];
    uint256 prize = amount.mul(payout);

    _claimed[msg.sender] = true;

    msg.sender.transfer(prize);

    emit ClaimedPrize(msg.sender, prize);

    return true;
  }

  //////////////////////////
  // Ending period functions

  /**
   * @dev Ends bet cycle by sending the balance of the contract to the
   * destination address.
   * @return Whether the balance could be sent or not.
   */
  function endBetCycle(address destination)
      public onlyOwner hasOutcome hasEnded returns (bool) {
    require( destination != address(0x0) );

    destination.transfer(address(this).balance);

    return true;
  }
}
