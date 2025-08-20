const AWS = require('aws-sdk');
const sharp = require('sharp');
const { config } = require('../config');

const s3 = new AWS.S3({
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
  region: config.aws.region
});

const getS3SignedUrl = (fileName, fileType) => {
  if (!config.aws.s3Bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  
  const s3Params = {
    Bucket: config.aws.s3Bucket,
    Key: `uploads/${Date.now()}_${fileName}`,
    Expires: 60,
    ContentType: fileType
  };
  
  return s3.getSignedUrlPromise('putObject', s3Params)
    .then(uploadURL => ({ 
      uploadURL, 
      key: s3Params.Key 
    }));
};

const reduceImageSize = async (buffer, maxWidth = 1024, quality = 80) => {
  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
};

module.exports = {
  s3,
  getS3SignedUrl,
  reduceImageSize
};