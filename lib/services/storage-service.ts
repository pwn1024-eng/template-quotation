import fs from 'fs';
import path from 'path';
import { generateStorageFolderName, generateQuotationFileName } from '@/lib/utils/sanitize';

export class StorageService {
  private baseStorageDir: string;
  private generatedDir: string;
  private tempDir: string;
  private previewsDir: string;

  constructor() {
    this.baseStorageDir = path.resolve(process.env.STORAGE_DIR || './storage');
    this.generatedDir = path.join(this.baseStorageDir, 'generated');
    this.tempDir = path.join(this.baseStorageDir, 'temp');
    this.previewsDir = path.join(this.baseStorageDir, 'previews');

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.baseStorageDir, this.generatedDir, this.tempDir, this.previewsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  public getGeneratedDir(): string {
    return this.generatedDir;
  }

  public getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Creates a dedicated storage directory for a new quotation generation
   */
  public createQuotationStorageFolder(templateSlug: string, customerName: string): { folderName: string; folderPath: string } {
    this.ensureDirectories();
    const folderName = generateStorageFolderName(templateSlug, customerName);
    const folderPath = path.join(this.generatedDir, folderName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    return { folderName, folderPath };
  }

  /**
   * Save a generated file into the quotation folder
   */
  public saveFile(folderPath: string, fileName: string, content: Buffer | string): string {
    const filePath = path.join(folderPath, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Read a file as buffer
   */
  public readFile(filePath: string): Buffer {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseStorageDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(fullPath);
  }

  /**
   * Check if file exists
   */
  public fileExists(filePath: string): boolean {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.baseStorageDir, filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Delete folder and all its contents
   */
  public deleteFolder(folderPath: string): void {
    const fullPath = path.isAbsolute(folderPath) ? folderPath : path.join(this.baseStorageDir, folderPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}

export const storageService = new StorageService();
export default storageService;
