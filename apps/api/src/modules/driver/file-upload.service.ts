import { Injectable, BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class FileUploadService {
  private readonly supabase;
  private readonly BUCKET_NAME = 'driver-documents';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase configuration missing. File uploads will be disabled.');
    }

    this.supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');
  }

  /**
   * Upload driver document (license, ID, vehicle photo, etc.)
   */
  async uploadDriverDocument(
    driverId: string,
    file: any, // Using any to avoid Express.Multer.File type issues
    documentType: 'license' | 'id' | 'vehicle' | 'insurance'
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException('File upload service not configured');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG and PNG images are allowed');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    try {
      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${driverId}/${documentType}/${Date.now()}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // Replace existing file
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new BadRequestException('Failed to upload file');
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('File upload error:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Delete driver document
   */
  async deleteDriverDocument(fileUrl: string): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathSegments = url.pathname.split('/');
      const fileName = pathSegments.slice(-3).join('/'); // Get last 3 segments (driverId/type/filename)

      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        console.error('Failed to delete file:', error);
      }
    } catch (error) {
      console.error('Delete file error:', error);
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(fileUrl: string, expiresIn: number = 3600): Promise<string> {
    if (!this.supabase) {
      return fileUrl;
    }

    try {
      const url = new URL(fileUrl);
      const pathSegments = url.pathname.split('/');
      const fileName = pathSegments.slice(-3).join('/');

      const { data, error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(fileName, expiresIn);

      if (error) {
        console.error('Failed to create signed URL:', error);
        return fileUrl;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Signed URL error:', error);
      return fileUrl;
    }
  }
}