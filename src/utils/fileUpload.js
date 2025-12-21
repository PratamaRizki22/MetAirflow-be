const {
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const {
  s3Client,
  s3Bucket,
  s3BaseUrl,
  isS3Configured,
  STORAGE_FOLDER_PREFIX,
} = require('../config/storage');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class FileUploadService {
  constructor() {
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB default
    this.allowedImageTypes = (
      process.env.ALLOWED_IMAGE_TYPES ||
      'image/jpeg,image/jpg,image/png,image/webp'
    ).split(',');
    this.allowedFileTypes = (
      process.env.ALLOWED_FILE_TYPES ||
      'image/jpeg,image/jpg,image/png,image/webp,application/pdf'
    ).split(',');
  }

  /**
   * Check if S3 is configured
   */
  checkS3Config() {
    if (!isS3Configured) {
      throw new Error(
        'S3 storage is not configured. Please check your environment variables.'
      );
    }
  }

  /**
   * Validate file type and size
   */
  validateFile(file, allowedTypes = null) {
    if (!file) {
      throw new Error('No file provided');
    }

    const types = allowedTypes || this.allowedFileTypes;
    if (!types.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${types.join(', ')}`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    return true;
  }

  /**
   * Generate S3 key (object path)
   */
  generateS3Key(originalName, folder = 'uploads') {
    const ext = path.extname(originalName);
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const filename = `${uniqueId}-${timestamp}${ext}`;

    return `${STORAGE_FOLDER_PREFIX}/${folder}/${filename}`;
  }

  /**
   * Upload file to S3/MinIO
   */
  async uploadFile(file, folder = 'uploads') {
    try {
      // Check S3 configuration
      this.checkS3Config();

      // Validate file
      this.validateFile(file);

      // Generate S3 key
      const key = this.generateS3Key(file.originalname, folder);

      // Upload to S3 using AWS SDK v3
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: s3Bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          // Make files publicly readable (optional, adjust based on needs)
          ACL: 'public-read',
        },
      });

      const result = await upload.done();

      // Generate public URL
      const url = `${s3BaseUrl}/${key}`;

      console.log(`✅ File uploaded to S3: ${key}`);

      return {
        key,
        url,
        bucket: s3Bucket,
        location: result.Location,
        etag: result.ETag,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(files, folder = 'uploads') {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return await Promise.all(uploadPromises);
  }

  /**
   * Delete file from S3/MinIO
   */
  async deleteFile(key) {
    try {
      this.checkS3Config();

      const command = new DeleteObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      });

      await s3Client.send(command);

      console.log(`✅ File deleted from S3: ${key}`);

      return {
        success: true,
        message: 'File deleted successfully',
        key,
      };
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultipleFiles(keys) {
    try {
      this.checkS3Config();

      const command = new DeleteObjectsCommand({
        Bucket: s3Bucket,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
        },
      });

      const result = await s3Client.send(command);

      console.log(`✅ ${result.Deleted?.length || 0} files deleted from S3`);

      return {
        success: true,
        deleted: result.Deleted || [],
        errors: result.Errors || [],
      };
    } catch (error) {
      console.error('S3 bulk delete error:', error);
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(key) {
    if (!key) return null;
    return `${s3BaseUrl}/${key}`;
  }

  /**
   * Upload PDF buffer to S3
   */
  async uploadPDFBuffer(pdfBuffer, fileName, folder = 'pdfs') {
    try {
      this.checkS3Config();

      const key = this.generateS3Key(fileName, folder);

      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
        ACL: 'public-read',
      });

      await s3Client.send(command);

      const url = `${s3BaseUrl}/${key}`;

      console.log(`✅ PDF uploaded to S3: ${key}`);

      return {
        key,
        url,
        bucket: s3Bucket,
        originalName: fileName,
        size: pdfBuffer.length,
      };
    } catch (error) {
      console.error('S3 PDF upload error:', error);
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }
  }
}

module.exports = new FileUploadService();
