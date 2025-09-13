require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    uri: process.env.MONGODB_URI,
    analyticsUri: process.env.MONGODB_URI_2,
    analyticsEnabled: process.env.ANALYTICS_DB_ENABLED === 'true',
    fallbackToPrimary: process.env.FALLBACK_TO_PRIMARY === 'true' || true, // Default to true
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },

  upload: {
    maxFileSize: '10mb',
    maxImageWidth: 1024,
    imageQuality: 80,
  },
};

const validateConfig = () => {
  const required = [
    'MONGODB_URI',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about analytics database if not configured
  if (process.env.ANALYTICS_DB_ENABLED === 'true' && !process.env.MONGODB_URI_2) {
    console.warn(
      '⚠️  ANALYTICS_DB_ENABLED is true but MONGODB_URI_2 is not configured. Dashboard will use primary database.'
    );
  }
};

module.exports = { config, validateConfig };
