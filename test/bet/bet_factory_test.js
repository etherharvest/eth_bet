const assertRevert = require('../helpers/assertRevert.js');
const expectEvent = require('../helpers/expectEvent.js');
const currentBlock = require('../helpers/currentBlock.js');
const getBalance = require('../helpers/getBalance.js');
const timeTravel = require('../helpers/timeTravel.js');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

//////////////////////////////////
// Test for BetCycleBasic contract

var Factory = artifacts.require('BetFactory');
var Broker = artifacts.require('BetCycle');

contract('BetFactory', function (
  [_, owner, first_gambler, second_gambler, third_gambler, destination]
) {
  const e_outcome = '0x4200000000000000000000000000000000000000000000000000000000000000';

  describe('manages a bet', function () {
    let factory;

    describe('when is owner', function() {
      beforeEach(async function () {
        factory = await Factory.new({from: owner});
      });

      it('generates an event', async function() {
        const id = 'is owner';
        const tx = await factory.create(id, 5, 1, 2, 3, 4, {from: owner});

        const bet = await factory.get(id);

        const e = await expectEvent.inTransaction(tx, 'BetCreated');
        assert.equal(bet, e.args.bet);
      });

      describe('when bet is created', function() {
        const id = 'is created';
        let broker;

        beforeEach(async function () {
          // Block 0
          await factory.create(id, 5, 3, 4, 5, 6, {from: owner});
          const bet = await factory.get(id);
          broker = await Broker.at(bet);
          // Block 1
          await broker.bet('0x41', {from: first_gambler, value: '1000000000000000000'});
          // Block 2
          await broker.bet('0x42', {from: second_gambler, value: '500000000000000000'})
          // Block 3
          await broker.bet('0x42', {from: third_gambler, value: '250000000000000000'})
        });

        it('can set an outcome', async function() {
          // Block 4
          await factory.setOutcome(id, e_outcome, {from: owner});
          const outcome = await broker.outcome();
          assert.equal(outcome, e_outcome);
        });

        it('can end bet cycle', async function() {
          // Block 4
          await factory.setOutcome(id, e_outcome, {from: owner});
          // Block 5
          timeTravel(1);
          const before = await getBalance(destination);
          const remaining = await getBalance(broker.address);

          // Block 6
          const tx = await factory.endBetCycle(id, destination, {from: owner});

          // Block 7
          const after = await getBalance(destination);
          // before + remaining == after
          assert.isTrue(before.plus(remaining).eq(after));
        });
      });
    });
  });

  describe('cannot manage a bet', function() {
    const id = 'is not owner';
    let factory;

    beforeEach(async function () {
      factory = await Factory.new({from: owner});
    });

    describe('when sender is not owner', function () {
      it('cannot create bets', async function() {
        await assertRevert(factory.create(id, 5, 3, 4, 5, 6, {from: destination}));
      });

      describe('when bet is created', function() {
        let broker;

        beforeEach(async function() {
          // Block 0
          await factory.create(id, 5, 3, 4, 5, 6, {from: owner});
          const bet = await factory.get(id);
          broker = await Broker.at(bet);
        });

        it('cannot set an outcome through factory', async function() {
          // Block 1, 2, 3
          timeTravel(3);
          // Block 4
          await assertRevert(factory.setOutcome(id, e_outcome, {from: destination}));
        });

        it('cannot set an outcome through broker', async function() {
          // Block 1, 2, 3
          timeTravel(3);
          // Block 4
          await assertRevert(broker.setOutcome(e_outcome, {from: owner}));
        });

        it('cannot end cycle through factory', async function() {
          // Block 1, 2, 3
          timeTravel(3);
          // Block 4
          await factory.setOutcome(id, e_outcome, {from: owner});
          // Block 5
          timeTravel(1);
          // Block 6
          await assertRevert(factory.endBetCycle(id, destination, {from: destination}));
        });

        it('cannot end cycle through broker', async function() {
          // Block 1, 2, 3
          timeTravel(3);
          // Block 4
          await factory.setOutcome(id, e_outcome, {from: owner});
          // Block 5
          timeTravel(1);
          // Block 6
          await assertRevert(broker.endBetCycle(destination, {from: owner}));
        });
      });
    });

    describe('when contract does not exist', function () {
      const id = "unexistent";

      it('reverts on setOutcome', async function() {
        await assertRevert(factory.setOutcome(id, e_outcome, {from: owner}));
      });

      it('reverts on endBetCycle', async function() {
        await assertRevert(factory.endBetCycle(id, destination, {from: owner}));
      });
    });

    describe('when contract already exist', function () {
      const id = "existent";

      beforeEach(async function() {
        await factory.create(id, 5, 3, 4, 5, 6, {from: owner});
      });

      it('reverts on creation', async function() {
        await assertRevert(factory.create(id, 5, 3, 4, 5, 6, {from: owner}));
      });
    });
  });
});
