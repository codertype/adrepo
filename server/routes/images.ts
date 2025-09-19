import { Router } from "express";
import { imageManager } from "../imageManager";
import { isAuthenticated } from "../replitAuth";

const router = Router();

// Get image usage report (admin only)
router.get("/usage-report", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user || !user.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Check if user is admin
    // You can implement admin check here based on your user roles
    
    const { imageId } = req.query;
    const report = await imageManager.getImageUsageReport(imageId as string);
    
    res.json(report);
  } catch (error) {
    console.error("Error fetching image usage report:", error);
    res.status(500).json({ message: "Failed to fetch image usage report" });
  }
});

// Get orphaned images (admin only)
router.get("/orphaned", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user || !user.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orphanedImages = await imageManager.findOrphanedImages();
    
    res.json(orphanedImages);
  } catch (error) {
    console.error("Error fetching orphaned images:", error);
    res.status(500).json({ message: "Failed to fetch orphaned images" });
  }
});

// Schedule orphaned images for cleanup (admin only)
router.post("/cleanup-orphaned", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user || !user.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cleanupCount = await imageManager.scheduleOrphanedImagesForCleanup();
    
    res.json({ 
      message: `Scheduled ${cleanupCount} orphaned images for cleanup`,
      count: cleanupCount 
    });
  } catch (error) {
    console.error("Error scheduling image cleanup:", error);
    res.status(500).json({ message: "Failed to schedule image cleanup" });
  }
});

// Get image statistics (admin only)
router.get("/statistics", isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user?.claims;
    if (!user || !user.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const stats = await imageManager.getImageStatistics();
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching image statistics:", error);
    res.status(500).json({ message: "Failed to fetch image statistics" });
  }
});

// Get images for specific entity
router.get("/entity/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    const images = await imageManager.getImagesByEntity(entityType, entityId);
    
    res.json(images);
  } catch (error) {
    console.error("Error fetching entity images:", error);
    res.status(500).json({ message: "Failed to fetch entity images" });
  }
});

export default router;