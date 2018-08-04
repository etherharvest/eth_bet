async function inLogs(logs, eventName) {
  const event = logs.find(e => e.event === eventName);
  assert.isTrue(event !== null && event !== undefined);
  return event;
};

async function inTransaction(tx, eventName) {
  const { logs } = await tx;
  return inLogs(logs, eventName);
};

module.exports = {
  inLogs,
  inTransaction,
};
