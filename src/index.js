require('dotenv').config();
import { MongoClient } from 'mongodb';
import assert from 'assert';
import Poller from './poller';

// mongo data
const url = 'mongodb://localhost:27017';
const dbName = 'tbg-tokens';

MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);
  
  const poller = new Poller({
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
    INFURA_API_KEY: process.env.INFURA_API_KEY,
    database: db,
  });

  poller.startLivePolling();
});