pragma solidity 0.4.24;

import "../bet/BetCycle.sol";


/**
 * @title BetFactory
 * @dev Bet factory contract.
 */
contract BetFactory is Ownable {

  /**
   * @dev Event triggered on successful bet creation.
   *
   * @param identifier Identifier of the bet contract.
   * @param bet Bet contract address.
   */
  event BetCreated(
    bytes32 indexed identifier,
    address indexed bet
  );

  /**
   * @dev Contracts by identifier.
   */
  mapping(bytes32 => address) _contracts;

  /////////////////////////////////
  // Information recovery functions

  /**
   * @dev Gets a contract's address by its identifier.
   *
   * @param identifier Identifier of the contract.
   *
   * @return The contract's address.
   */
  function get(bytes32 identifier) public view returns (address) {
    return _contracts[identifier];
  }

  ///////////////////////////
  // Administration functions

  /**
   * @dev Given offsets, creates a new betting cycle.
   *
   * @param identifier Bet identifier.
   * @param commission Commission of the contract.
   * @param bettingOffset Betting offset from the creation block.
   * @param publishingOffset Result publishing offset. Must be greater than
   * bettingOffset.
   * @param claimingOffset Claiming offset from the creation block. Must be
   * greater than publishingOffset.
   * @param endingOffset Bet cycle ending block offset from the creation block.
   * Must be greater than the claimingOffset.
   *
   * @return The address of the bet.
   */
  function create(
    bytes32 identifier,
    uint8 commission,
    uint256 bettingOffset,
    uint256 publishingOffset,
    uint256 claimingOffset,
    uint256 endingOffset
  ) public onlyOwner returns (address) {
    require(
      _contracts[identifier] == 0x0,
      "Contract identifier is already in use."
    );

    BetCycle bet = new BetCycle(
      commission,
      bettingOffset,
      publishingOffset,
      claimingOffset,
      endingOffset
    );

    address addr = address(bet);

    _contracts[identifier] = addr;

    emit BetCreated(identifier, addr);

    return addr;
  }

  /**
   * @dev Sets outcome of the bet.
   *
   * @param identifier Identifier of the contract.
   * @param outcome Outcome of the bet.
   *
   * @return Whether the outcome has been set or not.
   */
  function setOutcome(bytes32 identifier, bytes32 outcome)
      public onlyOwner returns (bool) {
    address bet = _contracts[identifier];

    require(
      bet != 0x0,
      "Contract identifier not found."
    );

    return BetCycle(bet).setOutcome(outcome);
  }

  /**
   * @dev Ends bet cycle by sending the balance of the contract to the
   * destination address.
   *
   * @param identifier Identifier of the contract.
   * @param destination Destination address.
   *
   * @return Whether the balance could be sent or not.
   */
  function endBetCycle(bytes32 identifier, address destination)
      public onlyOwner returns (bool) {
    address bet = _contracts[identifier];

    require(
      bet != 0x0,
      "Contract identifier not found."
    );

    return BetCycle(bet).endBetCycle(destination);
  }
}
