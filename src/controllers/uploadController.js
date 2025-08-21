const { s3, reduceImageSize } = require('../utils/s3Helper');
const { config } = require('../config');

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const file = req.file;
    const s3Key = `uploads/${Date.now()}_${file.originalname}`;
    let fileBuffer = file.buffer;
    
    console.log(`Processing upload: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
    
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      console.log('Resizing image...');
      try {
        fileBuffer = await reduceImageSize(
          file.buffer, 
          config.upload.maxImageWidth, 
          config.upload.imageQuality
        );
        console.log(`Image resized from ${file.size} to ${fileBuffer.length} bytes`);
      } catch (resizeError) {
        console.error('Error resizing image:', resizeError);
        throw new Error(`Image processing failed: ${resizeError.message}`);
      }
    }
    
    const params = {
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.mimetype
    };
    
    console.log(`Uploading to S3: bucket=${params.Bucket}, key=${params.Key}, size=${fileBuffer.length}`);
    
    const uploadResult = await s3.upload(params).promise();
    console.log('S3 upload successful:', uploadResult.Location);
    
    const s3Url = `https://${config.aws.s3Bucket}.s3-${config.aws.region}.amazonaws.com/${s3Key}`;
    
    res.json({ 
      success: true, 
      url: s3Url 
    });
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Error uploading file to S3';
    if (error.code === 'AccessDenied') {
      errorMessage = 'Insufficient permissions to upload to S3';
    } else if (error.code === 'NoSuchBucket') {
      errorMessage = 'S3 bucket not found';
    } else if (error.code === 'InvalidAccessKeyId') {
      errorMessage = 'Invalid AWS access key';
    } else if (error.code === 'SignatureDoesNotMatch') {
      errorMessage = 'Invalid AWS secret key';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      error_code: error.code || 'UNKNOWN_ERROR'
    });
  }
};

module.exports = {
  uploadFile
};