pragma solidity ^0.4.24;

import "../bet/BetCycleBasic.sol";


/**
 * @title BetCycle
 * @dev Implementation of a full betting cycle.
 */
contract BetCycle is BetCycleBasic {
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
  ) BetCycleBasic(
      bettingOffset,
      publishingOffset,
      claimingOffset,
      endingOffset
  ) public {}

  ///////////////////////////
  // Betting period functions

  /**
   * @dev Sets a new prediction.
   * @param newPrediction New prediction.
   * @return Whether the prediction has been changed or not.
   */
  function changePrediction(bytes32 newPrediction)
      public hasBet hasNoOutcome isBettingPeriod returns (bool) {
    bytes32 oldPrediction = _predictions[msg.sender];
    uint256 amount = _bets[msg.sender];

    require( newPrediction != 0x0 );
    require( newPrediction != oldPrediction );

    _predictions[msg.sender] = newPrediction;
    _count[newPrediction] = _count[newPrediction].add(amount);

    uint256 count = _count[oldPrediction].sub(amount);
    if ( count == 0 ) {
      delete _count[oldPrediction];
    } else {
      _count[oldPrediction] = count;
    }

    emit Bet(msg.sender, newPrediction, amount);

    return true;
  }

  /**
   * @dev Increases bet.
   * @return Whether the bet has been increased or not.
   */
  function increaseBet()
      public hasBet hasNoOutcome isBettingPeriod payable returns (bool) {
    bytes32 prediction = _predictions[msg.sender];
    uint256 oldBet = _bets[msg.sender];

    require( msg.value > 0 );

    uint256 newBet = oldBet.add(msg.value);

    _bets[msg.sender] = newBet;
    _count[prediction] = _count[prediction].add(msg.value);

    emit Bet(msg.sender, prediction, newBet);

    return true;
  }

  /**
   * @dev Decreases bet by an amount.
   * @param amount Amount to be decreased from the original bet.
   * @return Whether the bet has been increased or not.
   */
  function decreaseBet(uint256 amount)
      public hasBet hasNoOutcome isBettingPeriod returns (bool) {
    bytes32 prediction = _predictions[msg.sender];
    uint256 oldBet = _bets[msg.sender];

    require( amount > 0 );
    require( amount <= oldBet );

    uint256 count = _count[prediction].sub(amount);
    if ( count == 0 ) {
      delete _count[prediction];
    } else {
      _count[prediction] = count;
    }

    uint256 newBet = oldBet.sub(amount);
    if ( newBet == 0 ) {
      delete _bets[msg.sender];
      delete _predictions[msg.sender];
      emit BetCancelled(msg.sender, prediction, oldBet);
    } else {
      _bets[msg.sender] = newBet;
      emit Bet(msg.sender, prediction, newBet);
    }

    msg.sender.transfer(amount);

    return true;
  }
}
