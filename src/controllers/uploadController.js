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
    
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      fileBuffer = await reduceImageSize(
        file.buffer, 
        config.upload.maxImageWidth, 
        config.upload.imageQuality
      );
    }
    
    const params = {
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.mimetype
    };
    
    await s3.upload(params).promise();
    const s3Url = `https://${config.aws.s3Bucket}.s3-${config.aws.region}.amazonaws.com/${s3Key}`;
    
    res.json({ 
      success: true, 
      url: s3Url 
    });
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading file to S3' 
    });
  }
};

module.exports = {
  uploadFile
};