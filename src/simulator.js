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
        $lte: start,
        $gte: finish,
      }
    });
  }

  _getLogsOfLowestBlockAtThreshold(threshold) {
    return this._getLowestBlockByTokenAboveThreshold(threshold)
    .then(blockHeight => {
      this.currStep = blockHeight;
      return this._getLogsOfToken({ blockNumber: blockHeight })
    });
  } 

  _storeState(state) {
    return this.db.collection('STATS')
    .update({ blockNumber: state.blockNumber }, state, {upsert: true})
    .then(() => console.log(`Added new state object for block: ${state.blockNumber}`))
    .then(() => state);
  }

  _computeStateForTokens(logs) {
    const state = { blockNumber: this.currStep, data: {} };
    Object.keys(logs).forEach(key => {
      state.data = {...state.data,
        [key]: {
          totalTransferAmount: 0,
          from: {},
          to: {},
        }
      }
    });

    Object.keys(logs).forEach(key => {
      logs[key].forEach(log => {
        if (log.event == 'Transfer') {
          const sender = log.returnValues._from;
          const receiver = log.returnValues._to;
          const value = this.web3.utils.fromWei(log.returnValues._value, 'ether');

          state.data = {
            ...state.data,
            [key]: {
              totalTransferAmount: state.data[key].totalTransferAmount + value,
              from: {
                [sender]: {
                  ...state.data[key].from[sender],
                  value: (state.data[key].from[sender])
                    ? state.data[key].from[sender].value + value
                    : value,
                  count: (state.data[key].from[sender])
                    ? state.data[key].from[sender].count + 1
                    : 1,
                },
              },
              to: {
                [receiver]: {
                  ...state.data[key].to[receiver],
                  value: (state.data[key].to[receiver])
                    ? state.data[key].to[receiver].value + value
                    : value,
                  count: (state.data[key].to[receiver])
                    ? state.data[key].to[receiver].count + 1
                    : 1,
                },
              },
            },
          };
        }
      });
    });

    return state;
  }

  start() {
    return Promise.all([this._getLowestBlockByToken(), this._getHighestBlockByToken()])
    .then(blockHeights => {
      this.minBlock = blockHeights[0];
      this.maxBlock = blockHeights[1];
      this.currStep = this.minBlock;
      return this.step()();
    });
  }

  step() {
    return () => {
      if (this.currStep == this.maxBlock) return;

      this._getLogsOfLowestBlockAtThreshold(this.currStep)
      .then(logs => this._computeStateForTokens(logs))
      .then(this._storeState.bind(this))
      .then(() => this.currStep += 1)
      .then(() => setTimeout(this.step(), 1000));
    }
  }
}