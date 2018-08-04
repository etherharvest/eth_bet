async function getBalance(address) {
  return await web3.eth.getBalance(address);
};

module.exports = getBalance;
