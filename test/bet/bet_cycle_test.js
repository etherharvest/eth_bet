const assertRevert = require('../helpers/assertRevert.js');
const expectEvent = require('../helpers/expectEvent.js');
const currentBlock = require('../helpers/currentBlock.js');
const getBalance = require('../helpers/getBalance.js');
const timeTravel = require('../helpers/timeTravel.js');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

//////////////////////////////////
// Test for BetCycleBasic contract

var Broker = artifacts.require('BetCycle');

contract('BetCycle', function ([_, owner, gambler, other_gambler]) {
  const no_outcome = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const no_prediction = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const e_outcome = '0x4200000000000000000000000000000000000000000000000000000000000000';
  let broker;

  describe('can update the prediction', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('changes the prediction', async function() {
      // Block 1
      await broker.bet('0x41', {from: gambler, value: e_bet});
      const old_prediction = await broker.getPrediction(gambler);
      // Block 2
      await broker.changePrediction('0x42', {from: gambler})
      const new_prediction = await broker.getPrediction(gambler);

      assert.notEqual(old_prediction, new_prediction);
      assert.notEqual(new_prediction, no_prediction)
    });

    it('changes the support of a prediction', async function () {
      // Block 1
      await broker.bet('0x41', {from: gambler, value: e_bet});
      const old_prediction_before = await broker.getSupport('0x41');
      const new_prediction_before = await broker.getSupport('0x42');
      // Block 2
      await broker.changePrediction('0x42', {from: gambler})
      const old_prediction_after = await broker.getSupport('0x41');
      const new_prediction_after = await broker.getSupport('0x42');

      assert.isTrue(old_prediction_before.eq(e_bet));
      assert.isTrue(new_prediction_before.eq(0));
      assert.isTrue(old_prediction_after.eq(0));
      assert.isTrue(new_prediction_after.eq(e_bet));
    });

    it('changes the support of a prediction to non zero', async function () {
      // Block 1
      await broker.bet('0x41', {from: other_gambler, value: e_bet});
      // Block 2
      await broker.bet('0x41', {from: gambler, value: e_bet});
      const prediction_before = await broker.getSupport('0x41');
      // Block 3
      await broker.changePrediction('0x42', {from: gambler})
      const prediction_after = await broker.getSupport('0x41');

      assert.isTrue(prediction_before.minus(prediction_after).eq(e_bet));
    });

    it('generates a Bet event with the update', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2
      const tx = await broker.changePrediction(e_prediction, {from: gambler})

      const e = await expectEvent.inTransaction(tx, 'Bet');
      assert.equal(gambler, e.args.gambler);
      assert.equal(e_prediction, e.args.prediction);
      assert.equal(e_bet, e.args.bet);
    });
  });

  describe('cannot change prediction', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('when sender has not bet yet', async function () {
      await assertRevert(broker.changePrediction(e_prediction, {from: gambler}));
    });

    it('when there is an outcome', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await broker.setOutcome(e_outcome, {from: owner});
      // Block 5
      await assertRevert(broker.changePrediction(e_prediction, {from: gambler}));
    });

    it('when is not in the betting period', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await assertRevert(broker.changePrediction(e_prediction, {from: gambler}));
    });

    it('when the prediction is null', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2
      await assertRevert(broker.changePrediction('0x0', {from: gambler}));
    });

    it('when the new prediction is the same as the old one', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2
      await assertRevert(broker.changePrediction('0x42', {from: gambler}));
    });
  });

  describe('can increase bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('increases the bet', async function () {
      // Block 1
      await broker.bet('0x41', {from: gambler, value: e_bet});
      // Block 2
      await broker.increaseBet({from: gambler, value: e_bet});
      const bet = await broker.getBet(gambler);

      assert.equal(bet, e_bet * 2);
    });

    it('changes support for the prediction', async function () {
      // Block 1
      await broker.bet('0x41', {from: gambler, value: e_bet});
      const prediction_before = await broker.getSupport('0x41');
      // Block 2
      await broker.increaseBet({from: gambler, value: e_bet})
      const prediction_after = await broker.getSupport('0x41');

      assert.isTrue(prediction_before.eq(e_bet));
      assert.isTrue(prediction_after.eq(e_bet * 2));
    });

    it('generates a Bet event with the update', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
      // Block 2
      const tx = await broker.increaseBet({from: gambler, value: e_bet})

      const e = await expectEvent.inTransaction(tx, 'Bet');
      assert.equal(gambler, e.args.gambler);
      assert.equal(e_prediction, e.args.prediction);
      assert.equal(e_bet * 2, e.args.bet);
    });
  });

  describe('cannot increase bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('when there is no bet to increase', async function () {
      await assertRevert(broker.increaseBet({from: gambler, value: e_bet}));
    });

    it('when there is an outcome', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await broker.setOutcome(e_outcome, {from: owner});
      // Block 5
      await assertRevert(broker.increaseBet({from: gambler, value: e_bet}));
    });

    it('when is not betting period', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await assertRevert(broker.increaseBet({from: gambler, value: e_bet}));
    });

    it('when sent ether is zero', async function () {
      // Block 1
      await broker.bet('0x42', {from: gambler, value: e_bet});
      // Block 2
      await assertRevert(broker.increaseBet({from: gambler}));
    });
  });

  describe('can decrease the bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;
    const e_decrease = 250000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
    });

    it('decreases the bet', async function() {
      const expected = e_bet - e_decrease;
      // Block 2
      await broker.decreaseBet(e_decrease, {from: gambler});

      const bet = await broker.getBet(gambler);

      assert.isTrue(bet.eq(expected));
    });

    it('decreases the support for the prediction', async function () {
      const prediction_before = await broker.getSupport(e_prediction);
      const expected = prediction_before.minus(e_decrease);
      // Block 2
      await broker.decreaseBet(e_decrease, {from: gambler});
      const prediction_after = await broker.getSupport(e_prediction);

      assert.isTrue(prediction_after.eq(expected));
    });

    it('generates a Bet event with the update', async function () {
      // Block 2
      const tx = await broker.decreaseBet(e_decrease, {from: gambler});

      const e = await expectEvent.inTransaction(tx, 'Bet');
      assert.equal(gambler, e.args.gambler);
      assert.equal(e_prediction, e.args.prediction);
      assert.equal(e_bet - e_decrease, e.args.bet);
    });

    it('returns the excess to the gambler', async function () {
      const before = await getBalance(gambler);
      // Block 2
      const tx = await broker.decreaseBet(e_decrease, {from: gambler});
      const after = await getBalance(gambler);
      const gas = tx.receipt.gasUsed;
      const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;
      const expected = e_decrease - gas * gasPrice + before;

      // before - gas * gas_price + decrease == after
      assert.isTrue(
        before.minus(gasPrice.times(gas)).plus(e_decrease).eq(after)
      );
    });
  });

  describe('can cancel the bet by decreasing it to zero', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;
    const e_decrease = 250000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
    });

    it('cancels bet', async function () {
      // Block 2
      await broker.decreaseBet(e_bet, {from: gambler});

      const bet = await broker.getBet(gambler);
      const prediction = await broker.getPrediction(gambler);

      assert.isTrue(bet.eq(0));
      assert.equal(no_prediction, prediction);
    });

    it('decreases the support for the prediction', async function () {
      // Block 2
      await broker.decreaseBet(e_bet, {from: gambler});
      const support = await broker.getSupport(e_prediction);

      assert.isTrue(support.eq(0));
    });

    it('generates a BetCancelled event with the update', async function () {
      // Block 2
      const tx = await broker.decreaseBet(e_bet, {from: gambler});

      const e = await expectEvent.inTransaction(tx, 'BetCancelled');
      assert.equal(gambler, e.args.gambler);
      assert.equal(e_prediction, e.args.prediction);
      assert.equal(e_bet, e.args.bet);
    });
  });

  describe('cannot decrease bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;
    const e_decrease = 2500000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('when there is no bet to decrease', async function () {
      await assertRevert(broker.decreaseBet(e_decrease, {from: gambler}));
    });

    it('when there is an outcome', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await broker.setOutcome(e_outcome, {from: owner});
      // Block 5
      await assertRevert(broker.decreaseBet(e_decrease, {from: gambler}));
    });

    it('when is not betting period', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
      // Block 2, 3
      timeTravel(2);
      // Block 4
      await assertRevert(broker.decreaseBet(e_decrease, {from: gambler}));
    });

    it('when the decremented amount is zero', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: e_bet});
      // Block 2
      await assertRevert(broker.decreaseBet(0, {from: gambler}));
    });

    it('when amount exceeds the bet', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: gambler, value: 1});
      // Block 2
      await assertRevert(broker.decreaseBet(2, {from: gambler}));
    });
  });
});
