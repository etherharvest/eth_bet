async function timeTravel(blocks) {
  for (let i = 0; i < blocks; ++i) {
    await web3.currentProvider.send({
      id: 0,
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: []
    });
  }
};

module.exports = timeTravel;
