import EventEmitter from 'events';
import abi from 'human-standard-token-abi';

export default class Poller extends EventEmitter {
  constructor({ web3, ethAddresses, etherscanAPI }) {
    super();
    this.web3 = web3;
    this.etherscanAPI = etherscanAPI;
    this.ethAddresses = ethAddresses;
    this.contractNames = Object.keys(this.ethAddresses);
  }

  _func(key, fromBlock, toBlock, currBlock, pollFunc) {
    return () => {
      pollFunc.bind(this)(key, fromBlock, toBlock)
      .then(log => {
        console.log(`lll | contract = ${key}, log = ${log}, from = ${fromBlock}, to = ${toBlock}`)
        setTimeout(this._func(key, toBlock, toBlock + 1000, currBlock, pollFunc), this.contractNames.length * 1000);
      })
      .catch(err => {
        console.log(`eee | contract = ${key}, err = ${err}, from = ${fromBlock}, to = ${toBlock}`)
        setTimeout(this._func(key, toBlock, toBlock + 1000, currBlock, pollFunc), this.contractNames.length * 1000);
      });
    }
  };

  _callFunc(ctr, currBlock, pollFunc) {
    return () => {
      if (ctr >= this.contractNames.length) return;

      const startBlock = this.ethAddresses[this.contractNames[ctr]].block;
      this._func(this.contractNames[ctr], startBlock, startBlock + 1000, currBlock, pollFunc)();
      setTimeout(this._callFunc(++ctr, currBlock, pollFunc), 1000);
    }
  }

  _callEtherscanGetLogs(key, fromBlock, toBlock) {
    return this.etherscanAPI.log.getLogs(this.ethAddresses[key], fromBlock, toBlock)
  }
  
  _callWeb3GetLogs(key, fromBlock, toBlock) {
    return new Promise((resolve, reject) => {
      (new this.web3.eth.Contract(abi, this.ethAddresses[key].address))
      .getPastEvents("allevents", { fromBlock: fromBlock, toBlock: toBlock }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }


  pollWithWeb3() {
    this.etherscanAPI.proxy.eth_blockNumber()
    .then(res => res.result)
    .then(this.web3.utils.toDecimal)
    .then(currBlock => this._callFunc(0, currBlock, this._callWeb3GetLogs)())
    .catch(console.error)
  }

  pollWithEtherscan() {
    this.etherscanAPI.proxy.eth_blockNumber()
    .then(res => res.result)
    .then(this.web3.utils.toDecimal)
    .then(currBlock => this._callFunc(0, currBlock, this._callEtherscanGetLogs)())
    .catch(console.error)
  }
}
