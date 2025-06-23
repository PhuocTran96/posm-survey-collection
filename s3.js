// s3.js
const AWS = require('aws-sdk');
const sharp = require('sharp');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const S3_BUCKET = process.env.AWS_S3_BUCKET;

function getS3SignedUrl(fileName, fileType) {
  if (!S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');
  const s3Params = {
    Bucket: S3_BUCKET,
    Key: `uploads/${Date.now()}_${fileName}`,
    Expires: 60, // seconds
    ContentType: fileType
  };
  return s3.getSignedUrlPromise('putObject', s3Params).then(uploadURL => ({ uploadURL, key: s3Params.Key }));
}

// Reduce image size (buffer input, returns buffer)
async function reduceImageSize(buffer, maxWidth = 1024, quality = 80) {
  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

module.exports = {
  s3,
  getS3SignedUrl,
  reduceImageSize
}; 