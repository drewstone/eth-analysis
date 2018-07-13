import Promise from 'bluebird';
import EventEmitter from 'events';
import EtherscanAPI from 'etherscan-api';

export default class Simulator extends EventEmitter {
  constructor(args) {
    super();
    this.etherscanAPI = args.etherscanAPI
    this.web3 = args.web3;
    this.db = args.database;
    this.windowSize = args.windowSize
    this.stepSize = args.stepSize;
    this.collections = Object.keys(args.ethAddresses);
  }

  _getExtremeBlocksByToken(query, sortValue) {
    return Promise.map(this.collections, key => {
      return this.db.collection(key)
      .find(query)
      .sort({ "blockNumber": sortValue })
      .limit(1)
      .toArray()
      .then(res => {
        if (res.length > 0) {
          return { key, blockNumber: res[0].blockNumber }
        } else {
          return { key, blockNumber: null };
        }
      });
    })
    .then(results => {
      return results.reduce((prev, curr) => (Object.assign({}, prev, { [curr.key]: curr.blockNumber })), {})
    });
  }

  _getLowestBlockByToken() {
    return this._getExtremeBlocksByToken({}, 1)
    .then(blockHeights => Array.min(Object.values(blockHeights)));
  }

  _getHighestBlockByToken() {
    return this._getExtremeBlocksByToken({}, -1)
    .then(blockHeights => Array.min(Object.values(blockHeights)));
  }

  _getLowestBlockByTokenAboveThreshold(threshold) {
    return this._getExtremeBlocksByToken({ blockNumber: { $gte: threshold } }, 1)
    .then(blockHeights => Array.min(Object.values(blockHeights)));
  }

  _getLogsOfToken(query) {
    return Promise.props(
      this.collections.map(key => ({ key, promise: this.db.collection(key).find(query).toArray() }))
      .reduce((prev, curr) => (Object.assign({}, prev, { [curr.key]: curr.promise })), {})
    );
  }

  _getLogsFromBlock(num) {
    return this._getLogsOfToken({
      blockNumber: num
    });
  }

  _getLogsInInterval(start, finish) {
    return this._getLogsOfToken({
      blockNumber: {
        $gte: start,
        $lte: finish,
      }
    });
  }

  _getLogsOfLowestBlockAtThreshold(threshold) {
    return this._getLowestBlockByTokenAboveThreshold(threshold)
    .then(blockHeight => {
      this.currStep = blockHeight;
      return this._getLogsInInterval(this.currStep, this.currStep + 10000);
    });
  } 

  _storeState(states) {
    return Promise.resolve(Object.keys(states)
    .map(key => {
      return {
        blockNumber: Number(key),
        data: this.collections.map(col => {
          return {
            key: col,
            data: (states[key][col])
              ? states[key][col]
              : {
                totalTransferAmount: 0,
                from: {},
                to: {},
              }
          }
        })
        .reduce((prev, curr) => (Object.assign({}, prev, { [curr.key]: curr.data })), {}),
      }
    }))
    .then(states => {
      return this.db.collection('STATS').insertMany(states)
      .then(() => console.log(`Added new state objects for ${states.length} blocks`))
      .then(() => states);
    });
  }

  _computeStateForTokens(logs) {
    const states = {};

    Object.keys(logs).forEach(key => {
      logs[key].forEach(log => {
        if (log.event == 'Transfer') {
          if (!states[log.blockNumber]) {
            states[log.blockNumber] = {};
          }

          if (!states[log.blockNumber][key]) {
            states[log.blockNumber] = {
              ...states[log.blockNumber],
              [key]: {
                totalTransferAmount: 0,
                from: {},
                to: {},
              },
            };
          }

          const sender = log.returnValues._from;
          const receiver = log.returnValues._to;
          const value = this.web3.utils.fromWei(log.returnValues._value, 'ether');

          states[log.blockNumber][key] = {
            ...states[log.blockNumber][key],
            totalTransferAmount: states[log.blockNumber][key].totalTransferAmount + value,
            from: {
              [sender]: {
                ...states[log.blockNumber][key].from[sender],
                value: (states[log.blockNumber][key].from[sender])
                  ? states[log.blockNumber][key].from[sender].value + value
                  : value,
                count: (states[log.blockNumber][key].from[sender])
                  ? states[log.blockNumber][key].from[sender].count + 1
                  : 1,
              },
            },
            to: {
              [receiver]: {
                ...states[log.blockNumber][key].to[receiver],
                value: (states[log.blockNumber][key].to[receiver])
                  ? states[log.blockNumber][key].to[receiver].value + value
                  : value,
                count: (states[log.blockNumber][key].to[receiver])
                  ? states[log.blockNumber][key].to[receiver].count + 1
                  : 1,
              },
            },
          };
        }
      });
    });

    return states;
  }

  start(jumpstart) {
    return Promise.all([this._getLowestBlockByToken(), this._getHighestBlockByToken()])
    .then(blockHeights => {
      this.minBlock = blockHeights[0];
      this.maxBlock = blockHeights[1];
      this.currStep = (jumpstart) ? jumpstart : this.minBlock;
      return this.step()();
    });
  }

  step() {
    return () => {
      if (this.currStep == this.maxBlock) return;

      this._getLogsOfLowestBlockAtThreshold(this.currStep)
      .then(this._computeStateForTokens.bind(this))
      .then(this._storeState.bind(this))
      .then(() => this.currStep += 10000)
      .then(() => setTimeout(this.step(), 1000));
    }
  }
}