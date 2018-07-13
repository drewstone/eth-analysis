require('dotenv').config();
import { MongoClient } from 'mongodb';
import assert from 'assert';
import express from 'express';
import GraphWrapper from './graphs';

const app = express();

app.get('/charts', async function(req, res){
  const graphs = app.get('graphs');
  await graphs.getTxAmountHistogram();
  res.send('hell');
});

// mongo data
const url = 'mongodb://localhost:27017';
const dbName = 'tbg-tokens';

MongoClient.connect(url, function(err, client) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);
  const graphs = GraphWrapper(db);
  app.set('graphs', graphs);
  app.listen(3001);
});