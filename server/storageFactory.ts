import { ObjectStorageService } from "./objectStorage";
import VpsObjectStorageService from "./vpsObjectStorage";

export enum StorageType {
  GOOGLE_CLOUD = 'gcs',
  VPS_LOCAL = 'vps'
}

// Unified storage interface that both implementations should follow
export interface IObjectStorageService {
  getPublicObjectSearchPaths(): Array<string>;
  getPrivateObjectDir(): string;
  searchPublicObject(filePath: string): Promise<any>;
  downloadObject(file: any, res: any, cacheTtlSec?: number): Promise<void>;
  getObjectEntityUploadURL(): Promise<string>;
  getObjectEntityFile(objectPath: string): Promise<any>;
  normalizeObjectEntityPath(rawPath: string): string;
  trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: any): Promise<string>;
  canAccessObjectEntity(params: {
    userId?: string;
    objectFile: any;
    requestedPermission?: any;
  }): Promise<boolean>;
}

export class StorageFactory {
  private static instance: IObjectStorageService | null = null;
  private static storageType: StorageType | null = null;

  // Get the storage type from environment or default to VPS for better VPS compatibility
  static getStorageType(): StorageType {
    const configuredType = process.env.OBJECT_STORAGE_TYPE?.toLowerCase();
    
    switch (configuredType) {
      case 'gcs':
      case 'google':
      case 'cloud':
        return StorageType.GOOGLE_CLOUD;
      case 'vps':
      case 'local':
      case 'file':
      default:
        return StorageType.VPS_LOCAL;
    }
  }

  // Get the storage service instance (singleton pattern)
  static async getInstance(): Promise<IObjectStorageService> {
    const currentType = this.getStorageType();
    
    // Return existing instance if type hasn't changed
    if (this.instance && this.storageType === currentType) {
      return this.instance;
    }

    // Create new instance based on storage type
    console.log(`🗄️ Initializing ${currentType} storage service...`);
    
    try {
      switch (currentType) {
        case StorageType.GOOGLE_CLOUD:
          this.instance = await this.createGoogleCloudStorage();
          break;
        
        case StorageType.VPS_LOCAL:
        default:
          this.instance = await this.createVpsStorage();
          break;
      }
      
      this.storageType = currentType;
      console.log(`✅ ${currentType} storage service initialized successfully`);
      return this.instance;
      
    } catch (error) {
      console.error(`❌ Failed to initialize ${currentType} storage:`, error);
      
      // Fallback to VPS storage if GCS fails
      if (currentType === StorageType.GOOGLE_CLOUD) {
        console.log('🔄 Falling back to VPS local storage...');
        this.instance = await this.createVpsStorage();
        this.storageType = StorageType.VPS_LOCAL;
        console.log('✅ VPS fallback storage initialized');
        return this.instance;
      }
      
      throw error;
    }
  }

  // Create Google Cloud Storage instance
  private static async createGoogleCloudStorage(): Promise<IObjectStorageService> {
    // Check if required environment variables are set
    const requiredVars = ['PUBLIC_OBJECT_SEARCH_PATHS', 'PRIVATE_OBJECT_DIR'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(
        `Google Cloud Storage configuration incomplete. Missing: ${missingVars.join(', ')}\n` +
        'Please set these environment variables or use VPS storage instead.'
      );
    }
    
    return new ObjectStorageService();
  }

  // Create VPS Local Storage instance
  private static async createVpsStorage(): Promise<IObjectStorageService> {
    const vpsStorage = new VpsObjectStorageService();
    await vpsStorage.initialize();
    return vpsStorage;
  }

  // Reset instance (useful for testing or configuration changes)
  static reset(): void {
    this.instance = null;
    this.storageType = null;
  }

  // Check if storage service is available and properly configured
  static async healthCheck(): Promise<{
    type: StorageType;
    status: 'healthy' | 'unhealthy';
    error?: string;
  }> {
    const type = this.getStorageType();
    
    try {
      const storage = await this.getInstance();
      
      // Test basic functionality
      storage.getPublicObjectSearchPaths();
      storage.getPrivateObjectDir();
      
      return {
        type,
        status: 'healthy'
      };
      
    } catch (error) {
      return {
        type,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export factory instance for easy access
export const storageService = {
  async get(): Promise<IObjectStorageService> {
    return StorageFactory.getInstance();
  },
  
  getType(): StorageType {
    return StorageFactory.getStorageType();
  },
  
  async healthCheck() {
    return StorageFactory.healthCheck();
  }
};

export default StorageFactory;