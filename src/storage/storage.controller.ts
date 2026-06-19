import { Controller, Post, UseInterceptors, UploadedFiles, UseGuards } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
    constructor(private readonly storageService: StorageService) {}

    @Post('upload-multiple')
    @UseInterceptors(FilesInterceptor('files'))
    async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
        const urls = await Promise.all(
            files.map(file => this.storageService.uploadFile(file, 'maintenance'))
        );
        return { urls };
    }
}
