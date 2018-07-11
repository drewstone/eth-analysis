import Promise from 'bluebird';
import EventEmitter from 'events';

export default class Simulator extends EventEmitter {
  constructor(args) {
    super();
    this.db = args.database;
    this.windowSize = args.windowSize
    this.stepSize = args.stepSize;
    this.collections = Object.keys(args.ethAddresses);
  }

  _getExtremeBlocksByToken(sortValue) {
    return Promise.map(this.collections, key => {
      const collection = this.db.collection(key);
      return collection
      .find()
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

  _getLowestBlocksByToken() {
    return this._getExtremeBlocksByToken(1);
  }

  _getHighestBlocksByToken() {
    return this._getExtremeBlocksByToken(-1);
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
    })
  }

  _getLogsInInterval(start, finish) {
    return this._getLogsOfToken({
      blockNumber: {
        $lte: start,
        $gte: finish,
      }
    });
  }

  _computeState(logs) {
    console.log(logs);
  }

  start() {
    this._getLowestBlocksByCollection()
    .then(blockHeights => {
      this.minBlock = Array.min(Object.values(blockHeights));
      this.currStep = this.minBlock;
      return this._getHighestBlocksByToken();
    })
    .then(blockHeights => {
      this.maxBlock = Array.max(Object.values(blockHeights));

    });
  }

  step() {
    return () => {
      
    }
  }

  state() {

  }
}