require('dotenv').config();
import Web3 from 'web3';
import Poller from './poller';
import EthereumAddresses from './ethereumContractAddresses';

var web3 = new Web3();

if (typeof web3 !== 'undefined') {
  web3 = new Web3(web3.currentProvider);
} else {
  web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/${process.env.INFURA_API_KEY}`));
}

const poller = new Poller(web3, EthereumAddresses);
console.log(poller);

poller.on('event', (response) => {
  console.log(response);
});


