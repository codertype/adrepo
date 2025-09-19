import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { createReadStream, existsSync } from "fs";
import { ObjectAclPolicy, ObjectPermission } from "./objectAcl";
import mime from "mime-types";

export class VpsObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "VpsObjectNotFoundError";
    Object.setPrototypeOf(this, VpsObjectNotFoundError.prototype);
  }
}

export class VpsObjectStorageService {
  private baseDir: string;
  private publicDir: string;
  private privateDir: string;
  private tempDir: string;

  constructor() {
    // Use environment variable or default to VPS-friendly path
    this.baseDir = process.env.VPS_STORAGE_BASE_DIR || "/var/www/uploads";
    this.publicDir = path.join(this.baseDir, "public");
    this.privateDir = path.join(this.baseDir, "private");
    this.tempDir = path.join(this.baseDir, "temp");
  }

  // Initialize storage directories with proper permissions
  async initialize(): Promise<void> {
    try {
      console.log('🗄️ Initializing VPS Object Storage...');
      console.log(`   Base directory: ${this.baseDir}`);
      console.log(`   Public directory: ${this.publicDir}`);
      console.log(`   Private directory: ${this.privateDir}`);
      
      // Create base directories
      await this.ensureDirectory(this.baseDir);
      await this.ensureDirectory(this.publicDir);
      await this.ensureDirectory(this.privateDir);
      await this.ensureDirectory(this.tempDir);
      
      // Create category-specific subdirectories in both public and private
      const subdirs = [
        'products',
        'avatars', 
        'categories',
        'advertisements',
        'temp'
      ];
      
      for (const subdir of subdirs) {
        await this.ensureDirectory(path.join(this.publicDir, subdir));
        await this.ensureDirectory(path.join(this.privateDir, subdir));
      }
      
      console.log('✅ VPS Object Storage initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize VPS Object Storage:', error);
      throw error;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
      console.log(`📁 Created directory: ${dirPath}`);
    }
  }

  // Gets the public object search paths (VPS equivalent)
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.VPS_PUBLIC_OBJECT_SEARCH_PATHS || `${this.publicDir}/products,${this.publicDir}/categories,${this.publicDir}/advertisements`;
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    return paths;
  }

  // Gets the private object directory (VPS equivalent)
  getPrivateObjectDir(): string {
    const dir = process.env.VPS_PRIVATE_OBJECT_DIR || this.privateDir;
    return dir;
  }

  // Gets the public object directory
  getPublicObjectDir(): string {
    return this.publicDir;
  }

  // Search for a public object from the search paths
  async searchPublicObject(filePath: string): Promise<VpsFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = path.join(searchPath, filePath);
      
      try {
        await fs.access(fullPath);
        return new VpsFile(fullPath);
      } catch {
        // File doesn't exist, continue searching
      }
    }
    return null;
  }

  // Downloads an object to the response
  async downloadObject(file: VpsFile, res: Response, cacheTtlSec: number = 3600): Promise<void> {
    try {
      const filePath = file.getPath();
      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      // Get the ACL policy for the object
      const aclPolicy = await this.getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";

      // Set appropriate headers
      res.set({
        "Content-Type": mimeType,
        "Content-Length": stats.size.toString(),
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
        "Last-Modified": stats.mtime.toUTCString(),
        "ETag": `"${stats.mtime.getTime()}-${stats.size}"`,
      });

      // Stream the file to the response
      const stream = createReadStream(filePath);

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity (VPS implementation)
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const fileName = `${objectId}`;
    
    // For VPS, we return a URL that the backend will handle
    // The frontend will use this with a POST request to upload the file
    return `/api/vps-upload/${fileName}`;
  }

  // Handle file upload from multipart form data
  async handleFileUpload(
    fileBuffer: Buffer, 
    originalName: string, 
    mimeType: string, 
    category: string = 'temp',
    aclPolicy?: ObjectAclPolicy
  ): Promise<string> {
    // Validate file type
    if (!this.isAllowedMimeType(mimeType)) {
      throw new Error(`File type not allowed: ${mimeType}`);
    }

    // Validate file size (10MB max by default)
    const maxSize = parseInt(process.env.VPS_MAX_FILE_SIZE || '10485760');
    if (fileBuffer.length > maxSize) {
      throw new Error(`File too large: ${fileBuffer.length} bytes (max: ${maxSize})`);
    }

    // Generate secure filename
    const fileId = randomUUID();
    const extension = this.getFileExtension(originalName, mimeType);
    const fileName = `${fileId}${extension}`;
    
    // Determine storage directory based on ACL policy
    const isPublic = aclPolicy?.visibility === 'public';
    const baseDir = isPublic ? this.publicDir : this.privateDir;
    const categoryDir = path.join(baseDir, category);
    await this.ensureDirectory(categoryDir);
    
    const filePath = path.join(categoryDir, fileName);
    
    // Write file to disk
    await fs.writeFile(filePath, fileBuffer, { mode: 0o644 });
    
    // Set ACL policy if provided
    if (aclPolicy) {
      await this.setObjectAclPolicy(new VpsFile(filePath), aclPolicy);
    }
    
    // Return appropriate URL path based on visibility
    if (isPublic) {
      return `/public-objects/${category}/${fileName}`;
    } else {
      return `/objects/${category}/${fileName}`;
    }
  }

  // Get the object entity file from the object path
  async getObjectEntityFile(objectPath: string): Promise<VpsFile> {
    if (!objectPath.startsWith("/objects/") && !objectPath.startsWith("/public-objects/")) {
      throw new VpsObjectNotFoundError();
    }

    // Extract path from /objects/<category>/<filename> or /public-objects/<category>/<filename>
    const pathParts = objectPath.slice(1).split("/"); // Remove leading slash
    if (pathParts.length < 3) {
      throw new VpsObjectNotFoundError();
    }

    const isPublicPath = pathParts[0] === 'public-objects';
    const category = pathParts[1];
    const fileName = pathParts.slice(2).join("/");
    
    // Try to find file in appropriate directories
    const searchDirs = [];
    
    if (isPublicPath) {
      // For /public-objects/ paths, only search public directory
      searchDirs.push(path.join(this.publicDir, category, fileName));
    } else {
      // For /objects/ paths, search both private and public directories
      // (private first as /objects/ is primarily for ACL-controlled access)
      searchDirs.push(
        path.join(this.privateDir, category, fileName),
        path.join(this.publicDir, category, fileName)
      );
    }
    
    for (const filePath of searchDirs) {
      try {
        await fs.access(filePath);
        return new VpsFile(filePath);
      } catch {
        // File doesn't exist, continue searching
      }
    }
    
    throw new VpsObjectNotFoundError();
  }

  // Normalize object entity path (VPS implementation)
  normalizeObjectEntityPath(rawPath: string): string {
    // If it's already a normalized path, return as-is
    if (rawPath.startsWith("/objects/") || rawPath.startsWith("/public-objects/")) {
      return rawPath;
    }

    // If it's a full HTTP URL, extract the path
    if (rawPath.startsWith("http")) {
      try {
        const url = new URL(rawPath);
        return url.pathname;
      } catch {
        return rawPath;
      }
    }

    // If it's a direct file path, convert to object path
    if (rawPath.startsWith("/")) {
      // Check if it's in public directory
      const publicRelativePath = path.relative(this.publicDir, rawPath);
      if (publicRelativePath && !publicRelativePath.startsWith("..")) {
        return `/public-objects/${publicRelativePath.replace(/\\/g, "/")}`;
      }
      
      // Check if it's in private directory
      const privateRelativePath = path.relative(this.privateDir, rawPath);
      if (privateRelativePath && !privateRelativePath.startsWith("..")) {
        return `/objects/${privateRelativePath.replace(/\\/g, "/")}`;
      }
    }

    return rawPath;
  }

  // Set ACL policy for object entity
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    
    if (!normalizedPath.startsWith("/objects/") && !normalizedPath.startsWith("/public-objects/")) {
      return normalizedPath;
    }

    try {
      const objectFile = await this.getObjectEntityFile(normalizedPath);
      
      // Check if file needs to be moved based on new ACL policy
      const currentPath = objectFile.getPath();
      const isCurrentlyPublic = currentPath.includes(this.publicDir);
      const shouldBePublic = aclPolicy.visibility === 'public';
      
      if (isCurrentlyPublic !== shouldBePublic) {
        // Move file to appropriate directory
        const newPath = await this.moveFileToCorrectDirectory(objectFile, aclPolicy);
        await this.setObjectAclPolicy(new VpsFile(newPath), aclPolicy);
        
        // Return new normalized path
        return this.normalizeObjectEntityPath(newPath);
      } else {
        await this.setObjectAclPolicy(objectFile, aclPolicy);
        return normalizedPath;
      }
    } catch (error) {
      console.warn("Could not set ACL policy for object:", normalizedPath, error);
      return normalizedPath;
    }
  }

  // Move file to correct directory based on ACL policy
  private async moveFileToCorrectDirectory(
    objectFile: VpsFile,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const currentPath = objectFile.getPath();
    const shouldBePublic = aclPolicy.visibility === 'public';
    
    // Determine source and target directories
    const sourceDir = currentPath.includes(this.publicDir) ? this.publicDir : this.privateDir;
    const targetDir = shouldBePublic ? this.publicDir : this.privateDir;
    
    // Extract relative path
    const relativePath = path.relative(sourceDir, currentPath);
    const newPath = path.join(targetDir, relativePath);
    
    // Ensure target directory exists
    await this.ensureDirectory(path.dirname(newPath));
    
    // Move file
    await fs.rename(currentPath, newPath);
    
    // Move ACL file if it exists
    const oldAclPath = `${currentPath}.acl.json`;
    const newAclPath = `${newPath}.acl.json`;
    try {
      await fs.access(oldAclPath);
      await fs.rename(oldAclPath, newAclPath);
    } catch {
      // ACL file doesn't exist, continue
    }
    
    console.log(`📁 Moved file from ${currentPath} to ${newPath} (visibility: ${aclPolicy.visibility})`);
    return newPath;
  }

  // Check if user can access object entity
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: VpsFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    try {
      const aclPolicy = await this.getObjectAclPolicy(objectFile);
      
      // If object is public, allow read access
      if (aclPolicy?.visibility === "public" && requestedPermission === ObjectPermission.READ) {
        return true;
      }
      
      // If object is in public directory and no ACL policy, allow read access
      const filePath = objectFile.getPath();
      if (filePath.includes(this.publicDir) && requestedPermission === ObjectPermission.READ) {
        return true;
      }
      
      // If no user ID provided, deny access to private objects
      if (!userId) {
        return false;
      }
      
      // Check if user is the owner
      if (aclPolicy?.owner === userId) {
        return true;
      }
      
      // For private files, only allow access if user is authenticated
      // This can be extended based on specific ACL rules
      return !!userId;
    } catch {
      // If ACL policy can't be read, check if file is in public directory
      const filePath = objectFile.getPath();
      if (filePath.includes(this.publicDir) && requestedPermission === ObjectPermission.READ) {
        return true;
      }
      // Default to authenticated user access for private files
      return !!userId;
    }
  }

  // Get ACL policy from file metadata (stored as extended attributes or separate file)
  private async getObjectAclPolicy(file: VpsFile): Promise<ObjectAclPolicy | null> {
    try {
      const aclPath = `${file.getPath()}.acl.json`;
      const aclData = await fs.readFile(aclPath, 'utf-8');
      return JSON.parse(aclData);
    } catch {
      // Default ACL policy
      return {
        owner: '',
        visibility: 'private'
      };
    }
  }

  // Set ACL policy for file
  private async setObjectAclPolicy(file: VpsFile, aclPolicy: ObjectAclPolicy): Promise<void> {
    try {
      const aclPath = `${file.getPath()}.acl.json`;
      await fs.writeFile(aclPath, JSON.stringify(aclPolicy, null, 2), { mode: 0o644 });
    } catch (error) {
      console.warn("Could not write ACL policy:", error);
    }
  }

  // Validate allowed MIME types
  private isAllowedMimeType(mimeType: string): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    return allowedTypes.includes(mimeType.toLowerCase());
  }

  // Get file extension from filename and MIME type
  private getFileExtension(fileName: string, mimeType: string): string {
    // Try to get extension from filename first
    const extFromName = path.extname(fileName).toLowerCase();
    if (extFromName) {
      return extFromName;
    }

    // Fallback to MIME type
    const extFromMime = mime.extension(mimeType);
    if (extFromMime) {
      return `.${extFromMime}`;
    }

    // Default fallback
    return '.bin';
  }

  // Clean up old temporary files
  async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
    let cleanedCount = 0;
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const now = Date.now();

    try {
      const tempFiles = await fs.readdir(this.tempDir);
      
      for (const fileName of tempFiles) {
        const filePath = path.join(this.tempDir, fileName);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
      
      console.log(`🧹 Cleaned up ${cleanedCount} temporary files`);
    } catch (error) {
      console.warn("Error during temp file cleanup:", error);
    }

    return cleanedCount;
  }

  // Get storage statistics
  async getStorageStatistics(): Promise<{
    totalFiles: number;
    totalSize: number;
    categoryCounts: Record<string, number>;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      categoryCounts: {} as Record<string, number>
    };

    try {
      const categories = await fs.readdir(this.baseDir);
      
      for (const category of categories) {
        const categoryPath = path.join(this.baseDir, category);
        const categoryStats = await fs.stat(categoryPath);
        
        if (categoryStats.isDirectory()) {
          const files = await fs.readdir(categoryPath);
          let categoryCount = 0;
          
          for (const fileName of files) {
            if (!fileName.endsWith('.acl.json')) {
              const filePath = path.join(categoryPath, fileName);
              const fileStats = await fs.stat(filePath);
              
              if (fileStats.isFile()) {
                categoryCount++;
                stats.totalSize += fileStats.size;
              }
            }
          }
          
          stats.categoryCounts[category] = categoryCount;
          stats.totalFiles += categoryCount;
        }
      }
    } catch (error) {
      console.warn("Error getting storage statistics:", error);
    }

    return stats;
  }
}

// VPS File wrapper class
class VpsFile {
  constructor(private filePath: string) {}

  getPath(): string {
    return this.filePath;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(): Promise<{
    contentType: string;
    size: number;
    lastModified: Date;
  }> {
    const stats = await fs.stat(this.filePath);
    const contentType = mime.lookup(this.filePath) || "application/octet-stream";
    
    return {
      contentType,
      size: stats.size,
      lastModified: stats.mtime
    };
  }
}

// Export the VPS storage service as default
export default VpsObjectStorageService;