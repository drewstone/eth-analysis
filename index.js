require('dotenv').config();
import Web3 from 'web3';
import EtherscanAPI from 'etherscan-api';
import Poller from './poller';
import ethAddresses from './ethereumContractAddresses';

const etherscanAPI = EtherscanAPI.init(process.env.ETHERSCAN_API_KEY);
const web3 = new Web3(new Web3.providers.HttpProvider(`https://mainnet.infura.io/${process.env.INFURA_API_KEY}`));
const poller = new Poller({ web3, ethAddresses, etherscanAPI });

poller.pollWithWeb3();


