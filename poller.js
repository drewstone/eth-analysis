import EventEmitter from 'events';
import abi from 'human-standard-token-abi';

export default class Poller extends EventEmitter {
  constructor(web3, contractAddresses) {
    super();
    this.web3 = web3;
    this._setupTokenContracts(contractAddresses);
  }

  _setupTokenContracts(contractAddresses) {
    this.tokenContracts = Object.keys(this.contractAddresses)
    .map(key => {
      return {
        name: key,
        contract: self.web3.eth.contract(abi).at(contractAddress),
      }
    })
    .reduce((prev, curr) => {
      return Object.assign({}, prev, {
        [curr.key]: curr.contract,
      });
    }, {});
  }

  poll() {
    return;
  }
}
