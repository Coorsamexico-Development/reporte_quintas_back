import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class StorageService {
    private readonly uploadDir = join(process.cwd(), 'uploads');

    constructor() {
        this.ensureUploadDir();
    }

    private async ensureUploadDir() {
        try {
            await fs.access(this.uploadDir);
        } catch {
            await fs.mkdir(this.uploadDir, { recursive: true });
        }
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'general'): Promise<string> {
        try {
            const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
            const targetFolder = join(this.uploadDir, folder);
            
            // Ensure folder exists
            await fs.mkdir(targetFolder, { recursive: true });
            
            const filePath = join(targetFolder, fileName);
            await fs.writeFile(filePath, file.buffer);
            
            // Return public URL (Using relative path for now, should be updated to full URL in prod)
            return `/uploads/${folder}/${fileName}`;
        } catch (error) {
            console.error('File upload error:', error);
            throw new InternalServerErrorException('Error uploading file');
        }
    }

    /**
     * Placeholder for GCS Integration
     * To swap to GCS:
     * 1. npm install @google-cloud/storage
     * 2. Implement using the Storage SDK
     */
    /*
    async uploadToGCS(file: Express.Multer.File, bucketName: string): Promise<string> {
        // Implementation here
    }
    */
}
