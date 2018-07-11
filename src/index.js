require('dotenv').config();
import { MongoClient } from 'mongodb';
import assert from 'assert';
import Poller from './poller';
import Simulator from './simulator';
import ethAddresses from './addresses';

Array.min = function( array ){
  return Math.min.apply( Math, array );
};

Array.max = function( array ){
  return Math.max.apply( Math, array );
};

var program = require('commander');

program
  .option('-p, --poll', 'Poll for more data')
  .option('-s, --simulator', 'Start the similar')
  .parse(process.argv);

// mongo data
const url = 'mongodb://localhost:27017';
const dbName = 'tbg-tokens';

MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);

  if (program.poll) {
    const poller = new Poller({
      ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
      INFURA_API_KEY: process.env.INFURA_API_KEY,
      database: db,
      ethAddresses: ethAddresses,
    });

    poller.pollWithWeb3();    
  } else if (program.simulator) {
    const sim = new Simulator({
      database: db,
      windowSize: 1000,
      stepSize: 10,
      ethAddresses: ethAddresses,
    });

    sim.start();
  }
});