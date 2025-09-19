// Image Management System for Amrit Dairy
// Tracks which images are used by products, categories, and advertisements

import { db } from "./db";
import { 
  images, 
  imageUsage, 
  imageCleanup, 
  products, 
  categories, 
  advertisements 
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

export interface ImageInfo {
  id: string;
  url: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  altText?: string;
  uploadedBy?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImageUsageInfo {
  id: string;
  imageId: string;
  entityType: string; // product, category, advertisement, user_profile
  entityId: string;
  usageType: string; // primary, gallery, thumbnail, banner
  displayOrder: number;
  createdAt: Date;
}

export interface ImageUsageReport {
  imageId: string;
  imageUrl: string;
  filename: string;
  totalUsages: number;
  usages: {
    entityType: string;
    entityId: string;
    entityName?: string;
    usageType: string;
  }[];
}

class ImageManager {
  
  // Register a new image in the system
  async registerImage(imageData: {
    url: string;
    filename: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    altText?: string;
    uploadedBy?: string;
  }): Promise<ImageInfo> {
    const [image] = await db
      .insert(images)
      .values({
        ...imageData,
        usageCount: 0,
      })
      .returning();
    
    return image;
  }

  // Track image usage by an entity (product, category, advertisement)
  async trackImageUsage(data: {
    imageId: string;
    entityType: string;
    entityId: string;
    usageType: string;
    displayOrder?: number;
  }): Promise<ImageUsageInfo> {
    // Remove existing usage for this entity and usage type
    await this.removeImageUsage(data.entityType, data.entityId, data.usageType);
    
    // Add new usage
    const [usage] = await db
      .insert(imageUsage)
      .values({
        imageId: data.imageId,
        entityType: data.entityType,
        entityId: data.entityId,
        usageType: data.usageType,
        displayOrder: data.displayOrder || 0,
      })
      .returning();
    
    // Update usage count
    await this.updateImageUsageCount(data.imageId);
    
    return usage;
  }

  // Remove image usage
  async removeImageUsage(entityType: string, entityId: string, usageType?: string): Promise<void> {
    const conditions = [
      eq(imageUsage.entityType, entityType),
      eq(imageUsage.entityId, entityId)
    ];
    
    if (usageType) {
      conditions.push(eq(imageUsage.usageType, usageType));
    }
    
    // Get affected image IDs before deletion
    const affectedUsages = await db
      .select({ imageId: imageUsage.imageId })
      .from(imageUsage)
      .where(and(...conditions));
    
    // Delete usage records
    await db
      .delete(imageUsage)
      .where(and(...conditions));
    
    // Update usage counts for affected images
    for (const usage of affectedUsages) {
      await this.updateImageUsageCount(usage.imageId);
    }
  }

  // Update usage count for an image
  private async updateImageUsageCount(imageId: string): Promise<void> {
    const [result] = await db
      .select({ count: count() })
      .from(imageUsage)
      .where(eq(imageUsage.imageId, imageId));
    
    await db
      .update(images)
      .set({ 
        usageCount: result.count,
        updatedAt: new Date()
      })
      .where(eq(images.id, imageId));
  }

  // Get image usage report
  async getImageUsageReport(imageId?: string): Promise<ImageUsageReport[]> {
    const query = db
      .select({
        imageId: images.id,
        imageUrl: images.url,
        filename: images.filename,
        entityType: imageUsage.entityType,
        entityId: imageUsage.entityId,
        usageType: imageUsage.usageType,
      })
      .from(images)
      .leftJoin(imageUsage, eq(images.id, imageUsage.imageId));
    
    if (imageId) {
      query.where(eq(images.id, imageId));
    }
    
    const results = await query;
    
    // Group by image
    const imageMap = new Map<string, ImageUsageReport>();
    
    for (const row of results) {
      if (!imageMap.has(row.imageId)) {
        imageMap.set(row.imageId, {
          imageId: row.imageId,
          imageUrl: row.imageUrl,
          filename: row.filename,
          totalUsages: 0,
          usages: []
        });
      }
      
      const report = imageMap.get(row.imageId)!;
      
      if (row.entityType && row.entityId) {
        report.usages.push({
          entityType: row.entityType,
          entityId: row.entityId,
          usageType: row.usageType,
        });
        report.totalUsages++;
      }
    }
    
    return Array.from(imageMap.values());
  }

  // Find orphaned images (not used by any entity)
  async findOrphanedImages(): Promise<ImageInfo[]> {
    const orphanedImages = await db
      .select()
      .from(images)
      .where(eq(images.usageCount, 0));
    
    return orphanedImages;
  }

  // Schedule orphaned images for cleanup
  async scheduleOrphanedImagesForCleanup(): Promise<number> {
    const orphanedImages = await this.findOrphanedImages();
    
    if (orphanedImages.length === 0) {
      return 0;
    }
    
    const scheduledDeletion = new Date();
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 7); // 7 days from now
    
    const cleanupRecords = orphanedImages.map(image => ({
      imageId: image.id,
      reason: 'orphaned',
      scheduledDeletion,
    }));
    
    await db.insert(imageCleanup).values(cleanupRecords);
    
    return orphanedImages.length;
  }

  // Get images used by a specific entity
  async getImagesByEntity(entityType: string, entityId: string): Promise<ImageUsageReport[]> {
    const results = await db
      .select({
        imageId: images.id,
        imageUrl: images.url,
        filename: images.filename,
        usageType: imageUsage.usageType,
        displayOrder: imageUsage.displayOrder,
      })
      .from(imageUsage)
      .innerJoin(images, eq(imageUsage.imageId, images.id))
      .where(
        and(
          eq(imageUsage.entityType, entityType),
          eq(imageUsage.entityId, entityId),
          eq(imageUsage.isActive, true)
        )
      )
      .orderBy(imageUsage.displayOrder);
    
    return results.map(row => ({
      imageId: row.imageId,
      imageUrl: row.imageUrl,
      filename: row.filename,
      totalUsages: 1,
      usages: [{
        entityType,
        entityId,
        usageType: row.usageType,
      }]
    }));
  }

  // Update image information when entity changes
  async updateImageForEntity(
    entityType: string, 
    entityId: string, 
    newImageUrl: string,
    usageType: string = 'primary'
  ): Promise<void> {
    // Register new image if it doesn't exist
    let image = await db
      .select()
      .from(images)
      .where(eq(images.url, newImageUrl))
      .limit(1);
    
    if (image.length === 0) {
      const filename = newImageUrl.split('/').pop() || 'unknown';
      const [newImage] = await db
        .insert(images)
        .values({
          url: newImageUrl,
          filename,
          originalName: filename,
          usageCount: 0,
        })
        .returning();
      
      image = [newImage];
    }
    
    // Track the new usage
    await this.trackImageUsage({
      imageId: image[0].id,
      entityType,
      entityId,
      usageType,
    });
  }

  // Get comprehensive image statistics
  async getImageStatistics(): Promise<{
    totalImages: number;
    totalUsages: number;
    orphanedImages: number;
    imagesByEntity: {
      products: number;
      categories: number;
      advertisements: number;
    };
  }> {
    const [totalImagesResult] = await db
      .select({ count: count() })
      .from(images);
    
    const [totalUsagesResult] = await db
      .select({ count: count() })
      .from(imageUsage);
    
    const [orphanedResult] = await db
      .select({ count: count() })
      .from(images)
      .where(eq(images.usageCount, 0));
    
    const usageByEntity = await db
      .select({
        entityType: imageUsage.entityType,
        count: count()
      })
      .from(imageUsage)
      .groupBy(imageUsage.entityType);
    
    const imagesByEntity = {
      products: 0,
      categories: 0,
      advertisements: 0,
    };
    
    for (const usage of usageByEntity) {
      if (usage.entityType in imagesByEntity) {
        imagesByEntity[usage.entityType as keyof typeof imagesByEntity] = usage.count;
      }
    }
    
    return {
      totalImages: totalImagesResult.count,
      totalUsages: totalUsagesResult.count,
      orphanedImages: orphanedResult.count,
      imagesByEntity,
    };
  }
}

export const imageManager = new ImageManager();
export default imageManager;