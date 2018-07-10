import fs from 'fs';
import S3 from 'aws-sdk/clients/s3';
const s3 = new S3();

export default {
  // process.env.AWS_BUCKET_NAMES.split(',')
  createBuckets: (names) => {
    names.forEach(name => {
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
  },

  storeInBucket: ({ buffer, bucket, key, event, blockNumber, txHash }) => {
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
  },

  storeLocally: ({ buffer, bucket, key, event, blockNumber, txHash }) => {
    const prefix = `${key}-${event}-${blockNumber}-${txHash}`;

    try {
      const result = fs.writeFileSync(`./data/${prefix}.buf`, buffer,  "binary");
    } catch(e) {
      console.error(`Failed to save: ${prefix}`);
    }
  },
}