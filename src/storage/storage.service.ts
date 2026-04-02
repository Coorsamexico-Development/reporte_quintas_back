import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class StorageService {
    private readonly uploadDir = join(process.cwd(), 'uploads');
    private gcsStorage: Storage | null = null;
    private bucketName: string | null = null;

    constructor() {
        if (process.env.STORAGE_TYPE === 'GCS') {
            this.gcsStorage = new Storage();
            this.bucketName = process.env.GCS_BUCKET_NAME || 'reporte_quintas';
            console.log('Using Google Cloud Storage: ', this.bucketName);
        } else {
            this.ensureUploadDir();
            console.log('Using Local Storage in /uploads');
        }
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
            // Sanitize folder path (replace spaces and other chars)
            const sanitizedFolder = folder.replace(/[^a-zA-Z0-9/._-]/g, '_');
            
            // Si estamos en GCS
            if (this.gcsStorage && this.bucketName) {
                const bucket = this.gcsStorage.bucket(this.bucketName);
                // La ruta en GCS incluye el folder: folder/fileName
                const gcsFile = bucket.file(`${sanitizedFolder}/${fileName}`);

                await gcsFile.save(file.buffer, {
                    metadata: {
                        contentType: file.mimetype,
                    },
                    resumable: false,
                });

                // Devolver URL pública de GCS (asumiendo que el bucket tiene acceso público de lectura)
                return `https://storage.googleapis.com/${this.bucketName}/${sanitizedFolder}/${fileName}`;
            } 
            
            // Si estamos en Local
            else {
                const targetFolder = join(this.uploadDir, sanitizedFolder);
                await fs.mkdir(targetFolder, { recursive: true });
                
                const filePath = join(targetFolder, fileName);
                await fs.writeFile(filePath, file.buffer);
                
                return `/uploads/${sanitizedFolder}/${fileName}`;
            }
        } catch (error) {
            console.error('File upload error:', error);
            throw new InternalServerErrorException('Error uploading file');
        }
    }

    async getViewUrl(url: string | null): Promise<string> {
        if (!url) return '';
        
        const isGcsUrl = url.includes('storage.googleapis.com') || url.includes('storage.cloud.google.com');
        
        if (this.gcsStorage && this.bucketName && isGcsUrl) {
            try {
                // Extraer el path del archivo manejando diferentes formatos de URL de Google
                let filePath = '';
                if (url.includes(`${this.bucketName}/`)) {
                    filePath = url.split(`${this.bucketName}/`)[1].split('?')[0];
                }

                if (filePath) {
                    const [signedUrl] = await this.gcsStorage
                        .bucket(this.bucketName)
                        .file(filePath)
                        .getSignedUrl({
                            version: 'v4',
                            action: 'read',
                            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
                        });
                    return signedUrl;
                }
            } catch (e) {
                console.error('Error signing GCS URL:', e);
            }
        }
        return url;
    }

    async deleteFile(url: string): Promise<void> {
        const isGcsUrl = url.includes('storage.googleapis.com') || url.includes('storage.cloud.google.com');

        if (this.gcsStorage && this.bucketName && isGcsUrl) {
            try {
                const urlParts = url.split(`${this.bucketName}/`);
                if (urlParts.length > 1) {
                    const filePath = urlParts[1].split('?')[0];
                    await this.gcsStorage.bucket(this.bucketName).file(filePath).delete();
                }
            } catch (e) {
                console.error('Error deleting GCS file:', e);
            }
        }
    }
}
