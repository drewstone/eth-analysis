require('dotenv').config();
import S3 from 'aws-sdk/clients/s3';
import zlib from 'zlib';
import Poller from './poller';

const s3 = new S3();

process.env.AWS_BUCKET_NAMES.split(',').forEach(name => {
  var params = {
    Bucket: name, 
    CreateBucketConfiguration: {
      LocationConstraint: "us-west-1"
    }
  };

  s3.createBucket(params, function(err, data) {
    if (process.env.DEBUG) {
      if (err) console.log(err.stack); // an error occurred
      else     console.log(data);           // successful response
      /*
        data = {
          Location: "http://examplebucket.s3.amazonaws.com/"
        }
      */      
    }

  });
});

const poller = new Poller({
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
  INFURA_API_KEY: process.env.INFURA_API_KEY,
});

poller.pollWithWeb3();

poller.on('web3_getLogs', (result) => {
  if (result.logs) {
    result.logs.forEach(log => {
      zlib.gzip(JSON.stringify(log), (err, res) => {
        if (err) {
          if (process.env.DEBUG) console.error(`Error with GZIP: ${err}`);
        } else {
          storeBufferInS3({
            buffer: res,
            bucket: 'the-baire-group-token-data',
            key: result.key,
            event: log.event,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
          });
        }
      });
    });
  }
});

function storeBufferInS3({ buffer, bucket, key, event, blockNumber, txHash }) {
  const prefix = `${key}-${event}-${blockNumber}-${txHash}`;

  var params = {
    Body: buffer, 
    Bucket: bucket, 
    Key: prefix
  };

  s3.putObject(params, function(err, data) {
    if (process.env.DEBUG) {
      if (err) console.log(err.stack); // an error occurred
      else     console.log(data);           // successful response      
      /*
        data = {
          ETag: "\"6805f2cfc46c0f04559748bb039d69ae\"", 
          VersionId: "tpf3zF08nBplQK1XLOefGskR7mGDwcDk"
      }
      */
     }
  });
}

