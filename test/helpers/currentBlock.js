async function currentBlock() {
  return (await web3.eth.getBlock("latest")).number;
};

module.exports = currentBlock;
