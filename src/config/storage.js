const { S3Client } = require('@aws-sdk/client-s3');

// Check if AWS S3/MinIO is configured
const isS3Configured =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_BUCKET &&
  process.env.AWS_ACCESS_KEY_ID !== 'your_minio_access_key';

let s3Client = null;
let s3Config = {
  bucket: process.env.AWS_BUCKET || 'rentverse-uploads',
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  baseUrl: null,
};

if (isS3Configured) {
  try {
    const clientConfig = {
      region: s3Config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };

    // Custom endpoint for MinIO, Supabase, or other S3-compatible storage
    if (process.env.AWS_ENDPOINT) {
      clientConfig.endpoint = process.env.AWS_ENDPOINT;
      clientConfig.forcePathStyle =
        process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';

      // Base URL for MinIO/custom endpoint
      s3Config.baseUrl = process.env.AWS_URL || process.env.AWS_ENDPOINT;
    } else {
      // Standard AWS S3 URL
      s3Config.baseUrl = `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
    }

    s3Client = new S3Client(clientConfig);

    console.log('✅ S3 storage configured successfully');
    console.log(`   Bucket: ${s3Config.bucket}`);
    console.log(`   Region: ${s3Config.region}`);
    if (process.env.AWS_ENDPOINT) {
      console.log(`   Endpoint: ${process.env.AWS_ENDPOINT}`);
    }
  } catch (error) {
    console.error('❌ Failed to configure S3 storage:', error.message);
  }
} else {
  console.warn(
    '⚠️ S3 storage not configured. File upload features will be disabled.'
  );
  console.warn(
    'Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET in your .env file'
  );
}

module.exports = {
  s3Client,
  s3Bucket: s3Config.bucket,
  s3Region: s3Config.region,
  s3BaseUrl: s3Config.baseUrl,
  isS3Configured,
  STORAGE_FOLDER_PREFIX: process.env.STORAGE_FOLDER_PREFIX || 'rentverse',
};
