import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from './logger';

// Promisify fs methods for async/await usage
const fsExists = promisify(fs.exists);
const fsUnlink = promisify(fs.unlink);
const fsStat = promisify(fs.stat);
const fsMkdir = promisify(fs.mkdir);
const fsReaddir = promisify(fs.readdir);

export class FileUtils {
  //Check if a file exists
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsStat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  //Delete a file from the filesystem
  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      if (await this.fileExists(filePath)) {
        await fsUnlink(filePath);
        logger.info(`File deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  //Create directory if it doesn't exist
  static async ensureDirectory(dirPath: string): Promise<boolean> {
    try {
      if (!(await this.fileExists(dirPath))) {
        await fsMkdir(dirPath, { recursive: true });
        logger.info(`Directory created: ${dirPath}`);
      }
      return true;
    } catch (error) {
      logger.error(`Error creating directory ${dirPath}:`, error);
      return false;
    }
  }

  //Get file size in bytes
  static async getFileSize(filePath: string): Promise<number | null> {
    try {
      const stats = await fsStat(filePath);
      return stats.size;
    } catch (error) {
      logger.error(`Error getting file size for ${filePath}:`, error);
      return null;
    }
  }

  //Format file size to human readable format
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  //Get file extension from filename
  static getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  //Get filename without extension
  static getFileNameWithoutExtension(filename: string): string {
    return path.basename(filename, path.extname(filename));
  }

  //Generate unique filename
  static generateUniqueFilename(originalName: string): string {
    const ext = this.getFileExtension(originalName);
    const name = this.getFileNameWithoutExtension(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}_${timestamp}_${random}${ext}`;
  }

  //Validate file type against allowed types
  static isFileTypeAllowed(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimetype);
  }

  //Validate file size
  static isFileSizeValid(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  //Get MIME type from file extension
  static getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip'
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  //Clean up temporary files older than specified time
  static async cleanupOldFiles(directoryPath: string, maxAgeMs: number): Promise<number> {
    try {
      if (!(await this.fileExists(directoryPath))) {
        return 0;
      }

      const files = await fsReaddir(directoryPath);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fsStat(filePath);
        
        if (stats.isFile() && (now - stats.mtime.getTime()) > maxAgeMs) {
          if (await this.deleteFile(filePath)) {
            deletedCount++;
          }
        }
      }

      logger.info(`Cleaned up ${deletedCount} old files from ${directoryPath}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Error cleaning up old files in ${directoryPath}:`, error);
      return 0;
    }
  }

  //Get directory size (total size of all files)
  static async getDirectorySize(directoryPath: string): Promise<number> {
    try {
      if (!(await this.fileExists(directoryPath))) {
        return 0;
      }

      const files = await fsReaddir(directoryPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fsStat(filePath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        }
      }

      return totalSize;
    } catch (error) {
      logger.error(`Error calculating directory size for ${directoryPath}:`, error);
      return 0;
    }
  }

  //Copy file from source to destination
  static async copyFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destinationPath);
      await this.ensureDirectory(destDir);

      // Copy file
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(sourcePath);
        const writeStream = fs.createWriteStream(destinationPath);

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
      });

      logger.info(`File copied from ${sourcePath} to ${destinationPath}`);
      return true;
    } catch (error) {
      logger.error(`Error copying file from ${sourcePath} to ${destinationPath}:`, error);
      return false;
    }
  }

  //Move file from source to destination
  static async moveFile(sourcePath: string, destinationPath: string): Promise<boolean> {
    try {
      if (await this.copyFile(sourcePath, destinationPath)) {
        await this.deleteFile(sourcePath);
        logger.info(`File moved from ${sourcePath} to ${destinationPath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error moving file from ${sourcePath} to ${destinationPath}:`, error);
      return false;
    }
  }

  //Get file metadata
  static async getFileMetadata(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
    isFile?: boolean;
    isDirectory?: boolean;
  } | null> {
    try {
      if (!(await this.fileExists(filePath))) {
        return { exists: false };
      }

      const stats = await fsStat(filePath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      logger.error(`Error getting file metadata for ${filePath}:`, error);
      return null;
    }
  }

  //Validate file integrity by checking if file exists and has expected size
  static async validateFileIntegrity(filePath: string, expectedSize: number): Promise<boolean> {
    try {
      const actualSize = await this.getFileSize(filePath);
      return actualSize === expectedSize;
    } catch (error) {
      logger.error(`Error validating file integrity for ${filePath}:`, error);
      return false;
    }
  }

  //Create file backup with timestamp
  static async backupFile(filePath: string, backupDir?: string): Promise<string | null> {
    try {
      if (!(await this.fileExists(filePath))) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.basename(filePath);
      const backupFilename = `${this.getFileNameWithoutExtension(filename)}_backup_${timestamp}${this.getFileExtension(filename)}`;
      
      const backupPath = backupDir 
        ? path.join(backupDir, backupFilename)
        : path.join(path.dirname(filePath), backupFilename);

      if (await this.copyFile(filePath, backupPath)) {
        logger.info(`File backup created: ${backupPath}`);
        return backupPath;
      }

      return null;
    } catch (error) {
      logger.error(`Error creating backup for ${filePath}:`, error);
      return null;
    }
  }
}