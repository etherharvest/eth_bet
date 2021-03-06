const assertRevert = require('../helpers/assertRevert.js');
const expectEvent = require('../helpers/expectEvent.js');
const currentBlock = require('../helpers/currentBlock.js');
const getBalance = require('../helpers/getBalance.js');
const timeTravel = require('../helpers/timeTravel.js');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

//////////////////////////////////
// Test for BetCycleBasic contract

var Broker = artifacts.require('BetCycleBasic');

contract('BetCycleBasic', function (
  [_, owner, first_gambler, second_gambler, third_gambler, destination]
) {
  const no_outcome = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const no_prediction = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const e_outcome = '0x4200000000000000000000000000000000000000000000000000000000000000';
  let broker;

  describe('creates a bet cycle', function () {

    beforeEach(async function () {
      broker = await Broker.new(5, 1, 2, 3, 4, {from: owner});
    });

    it('when all offsets are valid', async function () {
      const block = await currentBlock();
      const bettingBlock = await broker.bettingBlock();
      const publishingBlock = await broker.publishingBlock();
      const claimingBlock = await broker.claimingBlock();
      const endingBlock = await broker.endingBlock();
      const outcome = await broker.outcome();
      const payout = await broker.payout();

      assert.equal(block + 1, bettingBlock);
      assert.equal(block + 2, publishingBlock);
      assert.equal(block + 3, claimingBlock);
      assert.equal(block + 4, endingBlock);
      assert(bettingBlock < publishingBlock);
      assert(publishingBlock < claimingBlock);
      assert(claimingBlock < endingBlock);

      assert.equal(outcome, no_outcome);
      assert.equal(payout, 0);
    });

    it('when commission is valid', async function () {
      const prizeBase = parseInt(await broker.prizeBase(), 10);
      assert.equal(prizeBase + 5, 100);
    });
  });

  describe('cannot create a bet cycle', function () {

    it('when betting offset is greater than publishing offset', async function () {
      await assertRevert(Broker.new(5, 2, 1, 3, 4, {from: owner}));
    });

    it('when publishing offset is greater than claiming offset', async function () {
      await assertRevert(Broker.new(5, 1, 3, 2, 4, {from: owner}));
    });

    it('when claiming offset is greater than ending offset', async function () {
      await assertRevert(Broker.new(5, 1, 2, 4, 3, {from: owner}));
    });

    it('when commission is greater than 100', async function () {
      await assertRevert(Broker.new(101, 1, 2, 3, 4, {from: owner}));
    })
  });

  describe('can create a bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1;
    const e_balance = 1;
    const e_support = 1;

    describe('when gambler has not bet before', function() {

      beforeEach(async function () {
        // Commission: 5%
        // Betting period: Blocks (0, 2)
        // Publishing period: Blocks [2, 3)
        // Claiming period: Blocks [3, 4)
        // Ending period: Blocks [4, ∞)

        // Block 0
        broker = await Broker.new(5, 1, 2, 3, 4, {from: owner});
      });

      it('generates an Bet event', async function () {
        // Block 1
        const tx = await broker.bet(e_prediction, {
          from: first_gambler,
          value: e_bet
        });

        const e = await expectEvent.inTransaction(tx, 'Bet');
        assert.equal(first_gambler, e.args.gambler);
        assert.equal(e_prediction, e.args.prediction);
        assert.equal(e_bet, e.args.bet);
      });

      it('sets the bet', async function () {
        // Block 1
        await broker.bet(e_prediction, {
          from: first_gambler,
          value: e_bet
        });

        const bet = await broker.getBet(first_gambler);
        assert.equal(e_bet, bet);
      });

      it('sets the prediction', async function () {
        // Block 1
        await broker.bet(e_prediction, {
          from: first_gambler,
          value: e_bet
        });

        const prediction = await broker.getPrediction(first_gambler);
        assert.equal(e_prediction, prediction);
      });

      it('adds bet to the balance of the contract', async function () {
        // Block 1
        await broker.bet(e_prediction, {
          from: first_gambler,
          value: e_bet
        });

        const balance = await getBalance(broker.address);
        assert.equal(e_balance, balance);
      });

      it('adds one to the support for the prediction', async function () {
        // Block 1
        await broker.bet(e_prediction, {
          from: first_gambler,
          value: e_bet
        });

        const support = await broker.getSupport(e_prediction);
        assert.equal(e_support, support);
      });
    });
  });

  describe('cannot create bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1;
    const e_balance = 1;
    const e_support = 1;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 3)
      // Publishing period: Blocks [3, 4)
      // Claiming period: Blocks [4, 5)
      // Ending period: Blocks [5, ∞)

      // Block 0
      broker = await Broker.new(5, 2, 3, 4, 5, {from: owner});
    });

    it('when the gambler already bet', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
      // Block 2
      await assertRevert(
        broker.bet(e_prediction, {from: first_gambler, value: e_bet})
      );
    });

    it('when is out of the betting period', async function () {
      // Blocks 1, 2
      await timeTravel(2);
      // Block 3
      await assertRevert(
        broker.bet(e_prediction, {from: first_gambler, value: e_bet})
      );
    });

    it('when prediction is null', async function () {
      // Block 1
      await assertRevert(
        broker.bet('0x0', {from: first_gambler, value: e_bet})
      );
    });

    it('when gambler is not sending ether', async function () {
      // Block 1
      await assertRevert(broker.bet(e_prediction, {from: first_gambler}));
    });
  });

  describe('can cancel a bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = 1000000000000000000;
    const e_balance = 1;
    const e_support = 1;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 3)
      // Publishing period: Blocks [3, 4)
      // Claiming period: Blocks [4, 5)
      // Ending period: Blocks [5, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    describe('when the gambler has a bet', function () {
      it('returns the bet ether to the gambler', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        const before = await getBalance(first_gambler);
        // Block 2
        const tx = await broker.cancelBet({from: first_gambler});
        const after = await getBalance(first_gambler);
        const gas = tx.receipt.gasUsed;
        const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;

        // before - (gas * gas_price) + bet == after
        assert.isTrue(
          before.minus(gasPrice.times(gas)).plus(e_bet).eq(after)
        );
      });

      it('generates a BetCancelled event', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        const tx = await broker.cancelBet({from: first_gambler});

        const e = await expectEvent.inTransaction(tx, 'BetCancelled');
        assert.equal(first_gambler, e.args.gambler);
        assert.equal(e_prediction, e.args.prediction);
        assert.equal(e_bet, e.args.bet);
      });

      it('decreases support for a prediction', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        await broker.bet(e_prediction, {from: second_gambler, value: e_bet});
        const oldSupport = await broker.getSupport(e_prediction);
        // Block 3
        const tx = await broker.cancelBet({from: first_gambler});
        const newSupport = await broker.getSupport(e_prediction);

        assert.isTrue(oldSupport.minus(newSupport).eq(e_bet));
      });

      it('resets the gambler\'s bet to zero', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        await broker.cancelBet({from: first_gambler});

        const bet = await broker.getBet(first_gambler);
        assert.isTrue(bet.eq(0));
      });

      it('resets the gambler\'s prediction to 0x0', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        await broker.cancelBet({from: first_gambler});

        const prediction = await broker.getPrediction(first_gambler);
        assert.equal(no_prediction, prediction);
      });

      it('decreases the balance of the contract', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        await broker.cancelBet({from: first_gambler});

        const balance = await getBalance(broker.address);
        assert.isTrue(balance.eq(0));
      });

      it('decreases support by one to the gambler\'s prediction', async function () {
        // Block 1
        await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
        // Block 2
        await broker.cancelBet({from: first_gambler});

        const support = await broker.getSupport(e_prediction);
        assert.isTrue(support.eq(0));
      });
    });
  });

  describe('cannot cancel bet', function () {
    const e_prediction = '0x4100000000000000000000000000000000000000000000000000000000000000';
    const e_bet = '1000000000000000000';

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
    });

    it('when the gambler does not have a bet', async function () {
      // Block 1
      await assertRevert(broker.cancelBet({from: first_gambler}));
    });

    it('when the gambler already cancelled their bet', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
      // Block 2
      await broker.cancelBet({from: first_gambler});
      // Block 3
      await assertRevert(broker.cancelBet({from: first_gambler}));
    });

    it('when is outside of the betting period', async function () {
      // Block 1
      await broker.bet(e_prediction, {from: first_gambler, value: e_bet});
      // Block 2, 3
      await timeTravel(2);
      // Block 4
      await assertRevert(broker.cancelBet({from: first_gambler}));
    });
  });

  describe('can set outcome', function () {
    const commission = 5;
    let e_payout;

    describe('when is owner', function () {
      beforeEach(async function () {
        // Commission: 5%
        // Betting period: Blocks (0, 4)
        // Publishing period: Blocks [4, 5)
        // Claiming period: Blocks [5, 6)
        // Ending period: Blocks [6, ∞)

        // Block 0
        broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
        // Block 1
        await broker.bet('0x41', {from: first_gambler, value: '1000000000000000000'});
        // Block 2
        await broker.bet('0x42', {from: second_gambler, value: '500000000000000000'});
        // Block 3
        await broker.bet('0x42', {from: third_gambler, value: '250000000000000000'});

        pool = await getBalance(broker.address);
        e_payout = pool.times(100 - commission).dividedToIntegerBy('750000000000000000');
      });

      it('sets payout and generates an Outcome event', async function () {
        //Block 4
        const tx = await broker.setOutcome(e_outcome, {from: owner});

        const payout = (await broker.payout()).toString();
        assert.equal(e_payout, payout);

        const e = await expectEvent.inTransaction(tx, 'Outcome');
        assert.equal(e_outcome, e.args.outcome);
        assert.equal(payout, e.args.payout);
      });
    });

    describe('when there is only one participant', function () {
      e_empty = '0x0000000000000000000000000000000000000000000000000000000000000000';

      beforeEach(async function () {
        // Commission: 5%
        // Betting period: Blocks (0, 4)
        // Publishing period: Blocks [4, 5)
        // Claiming period: Blocks [5, 6)
        // Ending period: Blocks [6, ∞)

        // Block 0
        broker = await Broker.new(5, 1, 2, 3, 4, {from: owner});
        // Block 1
        await broker.bet('0x42', {from: first_gambler, value: '1000000000000000000'});
      });

      it('cannot set outcome (forces refund)', async function () {
        //Block 2
        const tx = await broker.setOutcome(e_outcome, {from: owner});

        const outcome = (await broker.outcome()).toString();
        assert.equal(e_empty, outcome);
      });
    });
  });

  describe('cannot set outcome', function () {
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 2)
      // Publishing period: Blocks [2, 4)
      // Claiming period: Blocks [4, 5)
      // Ending period: Blocks [5, ∞)

      // Block 0
      broker = await Broker.new(5, 4, 5, 7, 8, {from: owner});
      // Block 1
      await broker.bet('0x41', {from: first_gambler, value: '1000000000000000000'});
      // Block 2
      await broker.bet('0x42', {from: second_gambler, value: '500000000000000000'});
      // Block 3
      await broker.bet('0x42', {from: third_gambler, value: '250000000000000000'});
    });

    it('when is not owner', async function () {
      //Block 4
      await timeTravel(1);
      //Block 5
      await assertRevert(broker.setOutcome(e_outcome));
    });

    it('when already has an outcome', async function () {
      //Block 4
      await timeTravel(1);
      //Block 5
      await broker.setOutcome(e_outcome, {from: owner});
      //Block 6
      await assertRevert(broker.setOutcome('0x41', {from: owner}));
    });

    it('when outcome is not valid', async function () {
      //Block 4
      await timeTravel(1);
      //Block 5
      await assertRevert(broker.setOutcome('0x0', {from: owner}));
    });

    it('when is in the betting period', async function () {
      //Block 4
      await assertRevert(broker.setOutcome(e_outcome, {from: owner}));
    });

    it('when is in the claiming period', async function () {
      //Block 4, 5, 6
      await timeTravel(3);
      //Block 7
      await assertRevert(broker.setOutcome(e_outcome, {from: owner}));
    });
  });

  describe('can refund', function () {
    describe('when there is no outcome but is the claiming period', function () {
      const e_bet = 1000000000000000000;

      beforeEach(async function () {
        // Commission: 5%
        // Betting period: Blocks (0, 4)
        // Publishing period: Blocks [4, 5)
        // Claiming period: Blocks [5, 6)
        // Ending period: Blocks [6, ∞)

        // Block 0
        broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
        // Block 1
        await broker.bet('0x41', {from: first_gambler, value: e_bet});
        // Block 2
        await broker.bet('0x42', {from: second_gambler, value: e_bet / 2});
        // Block 3
        await broker.bet('0x42', {from: third_gambler, value: e_bet / 3});
        // Block 4
        await timeTravel(1);
      });

      it('refunds the ether to the gambler', async function() {
        const before = await getBalance(first_gambler);
        // Block 5
        const tx = await broker.refund({from: first_gambler});
        const after = await getBalance(first_gambler);
        const gas = tx.receipt.gasUsed;
        const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;

        // before - gas * gas_price + bet == after
        assert.isTrue(
          before.minus(gasPrice.times(gas)).plus(e_bet).eq(after)
        );
      });

      it('generates a Refund event', async function () {
        // Block 5
        const tx = await broker.refund({from: first_gambler});

        const e = await expectEvent.inTransaction(tx, 'Refund');
        assert.equal(first_gambler, e.args.gambler);
        assert.equal(e_bet, e.args.amount);
      });
    });
  });

  describe('cannot refund', function () {
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 6)
      // Ending period: Blocks [6, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 6, {from: owner});
      // Block 1
      await broker.bet('0x41', {from: first_gambler, value: e_bet});
      // Block 2
      await broker.bet('0x42', {from: second_gambler, value: e_bet / 2});
      // Block 3
      await broker.bet('0x42', {from: third_gambler, value: e_bet / 3});
    });

    it('when the sender did not bet', async function () {
      // Block 4
      await timeTravel(1);
      // Block 5
      await assertRevert(broker.refund({from: owner}));
    });

    it('when there is an outcome', async function () {
      // Block 4
      await broker.setOutcome(e_outcome, {from: owner});
      // Block 5
      await assertRevert(broker.refund({from: first_gambler}));
    });

    it('when is not claiming period', async function () {
      // Block 4
      await assertRevert(broker.refund({from: first_gambler}));
    });

    it('when the refund has been already claimed', async function () {
      // Block 4
      await timeTravel(1);
      // Block 5
      await broker.refund({from: first_gambler});
      // Block 6
      await assertRevert(broker.refund({from: first_gambler}));
    });
  });

  describe('can claim prize', function () {
    describe('when gambler won', function () {

      beforeEach(async function () {
        // Commission: 5%
        // Betting period: Blocks (0, 4)
        // Publishing period: Blocks [4, 5)
        // Claiming period: Blocks [5, 7)
        // Ending period: Blocks [7, ∞)

        // Block 0
        broker = await Broker.new(5, 3, 4, 5, 7, {from: owner});
        // Block 1
        await broker.bet('0x41', {from: first_gambler, value: '1000000000000000000'});
        // Block 2
        await broker.bet('0x42', {from: second_gambler, value: '500000000000000000'})
        // Block 3
        await broker.bet('0x42', {from: third_gambler, value: '250000000000000000'})
        // Block 4
        await broker.setOutcome('0x42', {from: owner});
      });

      it('generates a ClaimedPrize event', async function () {
        const payout = await broker.payout();
        const bet = await broker.getBet(second_gambler);
        const prize = payout.times(bet).dividedToIntegerBy(100);
        // Block 5
        const tx = await broker.claim({from: second_gambler});

        const e = await expectEvent.inTransaction(tx, 'ClaimedPrize');
        assert.equal(second_gambler, e.args.winner);
        assert.isTrue(prize.eq(e.args.prize));
      });

      it('sends the prize to the winner', async function () {
        const payout = await broker.payout();
        const bet = await broker.getBet(second_gambler);
        const prize = payout.times(bet).dividedToIntegerBy(100);
        // Block 5
        const before = await getBalance(second_gambler);
        const tx = await broker.claim({from: second_gambler});
        const after = await getBalance(second_gambler);
        const gas = tx.receipt.gasUsed;
        const gasPrice = (await web3.eth.getTransaction(tx.tx)).gasPrice;

        // before - gas * gas_price + prize == after
        assert.isTrue(
          before.minus(gasPrice.times(gas)).plus(prize).eq(after)
        );
      });
    });
  });

  describe('cannot claim the prize', function () {
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 4)
      // Publishing period: Blocks [4, 5)
      // Claiming period: Blocks [5, 7)
      // Ending period: Blocks [7, ∞)

      // Block 0
      broker = await Broker.new(5, 3, 4, 5, 7, {from: owner});
      // Block 1
      await broker.bet('0x41', {from: first_gambler, value: e_bet})
      // Block 2
      await broker.bet('0x42', {from: second_gambler, value: e_bet / 2})
      // Block 3
      await broker.bet('0x42', {from: third_gambler, value: e_bet / 3})
    });

    it('when has not bet', async function () {
      // Block 4
      await broker.setOutcome('0x42', {from: owner});
      // Block 5
      await assertRevert(broker.claim({from: owner}));
    });

    it('when has no outcome', async function () {
      // Block 4
      await timeTravel(1);
      // Block 5
      await assertRevert(broker.claim({from: first_gambler}));
    });

    it('when is not claiming period', async function () {
      // Block 4
      await broker.setOutcome('0x42', {from: owner});
      // Block 5, 6
      await timeTravel(2);
      // Block 7
      await assertRevert(broker.claim({from: second_gambler}));
    });

    it('when outcome is not equal to prediction', async function() {
      // Block 4
      await broker.setOutcome('0x42', {from: owner});
      // Block 5
      await assertRevert(broker.claim({from: first_gambler}));
    });

    it('when the prize is already claimed', async function () {
      // Block 4
      await broker.setOutcome('0x42', {from: owner});
      // Block 5
      await broker.claim({from: second_gambler});
      // Block 6
      await assertRevert(broker.claim({from: second_gambler}));
    });
  });

  describe('can end bet cycle', function () {
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 2)
      // Publishing period: Blocks [2, 3)
      // Claiming period: Blocks [3, 4)
      // Ending period: Blocks [4, ∞)

      // Block 0
      broker = await Broker.new(5, 1, 2, 3, 4, {from: owner});
      // Block 1
      await broker.bet('0x41', {from: first_gambler, value: e_bet})
      // Block 2
      await broker.setOutcome('0x42', {from: owner});
    });

    describe('when is owner, has outcome and has ended', function () {
      it('claims the remaining ether in the specified address', async function() {
        // Block 3
        await timeTravel(1);
        // Block 4
        const before = await getBalance(destination);
        const remaining = await getBalance(broker.address);
        const tx = await broker.endBetCycle(destination, {from: owner});
        const after = await getBalance(destination);

        // before + remaining == after
        assert.isTrue(before.plus(remaining).eq(after));
      });
    });
  });

  describe('cannot end bet cycle', function () {
    const e_bet = 1000000000000000000;

    beforeEach(async function () {
      // Commission: 5%
      // Betting period: Blocks (0, 2)
      // Publishing period: Blocks [2, 3)
      // Claiming period: Blocks [3, 4)
      // Ending period: Blocks [4, ∞)

      // Block 0
      broker = await Broker.new(5, 1, 2, 3, 4, {from: owner});
      // Block 1
      await broker.bet('0x41', {from: first_gambler, value: e_bet})
    });

    it('when sender is not owner', async function () {
      // Block 2
      await broker.setOutcome('0x42', {from: owner});
      // Block 3
      await timeTravel(1);
      // Block 4
      await assertRevert(broker.endBetCycle(destination, {from: destination}));
    });

    it('when it does not have outcome', async function () {
      // Block 2, 3
      await timeTravel(2);
      // Block 4
      await assertRevert(broker.endBetCycle(destination, {from: owner}));
    });

    it('when it has not ended', async function () {
      // Block 2
      await broker.setOutcome('0x42', {from: owner});
      // Block 3
      await assertRevert(broker.endBetCycle(destination, {from: owner}));
    });

    it('when destination address is null', async function () {
      // Block 2
      await broker.setOutcome('0x42', {from: owner});
      // Block 3
      await timeTravel(1);
      // Block 4
      await assertRevert(broker.endBetCycle(ZERO_ADDRESS, {from: owner}));
    });
  });
});
