import Promise from 'bluebird';
import EventEmitter from 'events';
import abi from 'human-standard-token-abi';
import Web3 from 'web3';
import EtherscanAPI from 'etherscan-api';

export default class Poller extends EventEmitter {
  constructor({ ETHERSCAN_API_KEY, INFURA_API_KEY, database, ethAddresses }) {
    super();
    this.web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/${INFURA_API_KEY}`));
    this.etherscanAPI = EtherscanAPI.init(ETHERSCAN_API_KEY);
    this.ethAddresses = ethAddresses;
    this.contractNames = Object.keys(this.ethAddresses);
    this.contracts = this._setupTokenContracts()
    this.db = database;

    this.terminations = 0;
    this.on('web3_getLogs', this.handlePolledResults);
    this.on('end_of_poll', (key) => {
      this.terminations += 1;

      if (this.terminations == this.contractNames.length) {
        console.log('-----------------------------------------');
        console.log('\n\n\n');
        console.log('ALL TOKENS FINISHED POLLING');
        console.log('\n\n\n');
        console.log('-----------------------------------------');
        process.exit();
      }
    });
  }

  _refreshEthAddressesInfo() {
    return Promise.map(this.contractNames, key => {
      const collection = this.db.collection(key);
      return collection.find()
      .sort({ "blockNumber": -1 })
      .limit(1)
      .toArray()
      .then(res => ({ key, blockNumber: res[0].blockNumber }))
    })
    .then(results => results.reduce((prev, curr) => (Object.assign({}, prev, { [curr.key]: curr.blockNumber })), {}));
  }

  _setupTokenContracts() {
    return this.contractNames
    .map(key => ({ name: key, contract: new this.web3.eth.Contract(abi, this.ethAddresses[key].address) }))
    .reduce((prev, curr) => (Object.assign({}, prev, { [curr.name]: curr.contract })), {});
  }

  _func(key, fromBlock, toBlock, currBlock, pollFunc, time=1000) {
    return () => {
      if (fromBlock >= currBlock) {
        this.emit('end_of_poll', key);
        return;
      } else if (toBlock >= currBlock) {
        toBlock = currBlock
      }

      pollFunc.bind(this)(key, fromBlock, toBlock)
      .then(logs => {
        if (process.env.DEBUG) console.log(`lll | contract = ${key}, logs = ${logs.length}, from = ${fromBlock}, to = ${toBlock}`)
        this.emit('web3_getLogs', { key: key, logs: logs });
        setTimeout(this._func(key, toBlock, toBlock + 10000, currBlock, pollFunc, time), this.contractNames.length * time);
      })
      .catch(err => {
        if (process.env.DEBUG) console.log(`eee | contract = ${key}, err = ${err}, from = ${fromBlock}, to = ${toBlock}`)
        setTimeout(this._func(key, toBlock, toBlock + 10000, currBlock, pollFunc, time), this.contractNames.length * time);
      });
    }
  };

  _callFunc(ctr, currBlock, pollFunc, time=1000) {
    return () => {
      if (ctr >= this.contractNames.length) return;

      const startBlock = this.ethAddresses[this.contractNames[ctr]].block;
      this._func(this.contractNames[ctr], startBlock, startBlock + 1000, currBlock, pollFunc, time)();
      setTimeout(this._callFunc(++ctr, currBlock, pollFunc), time);
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
    .then(currBlock => {
      console.log(`Current block: ${currBlock}`);
      return this._callFunc(0, currBlock, this._callWeb3GetLogs, 0)()
    })
    .catch(console.error)
  }

  pollWithEtherscan() {
    this.etherscanAPI.proxy.eth_blockNumber()
    .then(res => res.result)
    .then(this.web3.utils.toDecimal)
    .then(currBlock => {
      console.log(`Current block: ${currBlock}`);
      this._callFunc(0, currBlock, this._callEtherscanGetLogs)()
    })
    .catch(console.error)
  }

  handlePolledResults({ key, logs }) { 
    if (logs.length > 0) {
      this.db.collection(key).insertMany(logs, (err, res) => {
        if (err) console.error(err);
        // else console.log(res);
      });
    }
  }
}
